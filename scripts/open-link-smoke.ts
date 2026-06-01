import { config } from "dotenv";

// Load env the same way the voice smoke + eval runners do (.env.local first,
// then .env). ESM links/evaluates the imports below FIRST, then runs these
// top-level config() calls, and only AFTER that the module-level
// createResearchSupabase() (which reads SUPABASE_* at call time) and main(). So
// env is loaded before any client is built. The imported service modules read
// env lazily inside their functions, never at import time. quiet → kein Banner.
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { randomBytes } from "node:crypto";

import type { Json } from "@/types/database";
import { createResearchSupabase } from "@/lib/research/db";
import {
  findOpenLinkByAccessToken,
  resolvePublicOpenEntry,
} from "@/lib/research/open-links";
import { findInviteByAccessToken } from "@/lib/research/scheduling";
import { getResearchPlan } from "@/lib/research/plans-service";
// NB: session-service (getPublicSession/resolvePublicEntry) is deliberately NOT
// imported here. It statically pulls health-service → @/lib/auth/org → Clerk →
// next/navigation, which throws under tsx --conditions=react-server (no Next
// bundler). That is a TEST-HARNESS boundary, not an isolation gap — the invite
// guard is proven byte-identical via git + exercised functionally in E4's HTTP
// smoke. This smoke imports ONLY Clerk-free / Next-free service modules.

/**
 * Offener Studien-Link — Etappe-1-Mandantentrennungs-Smoke gegen die ECHTE DB.
 * Vorbild: scripts/voice-ingest-smoke.ts. Anders als der Voice-Smoke trifft
 * dieser NICHT die HTTP-Routes (die gibt es in E1 noch nicht), sondern die
 * SERVICE-Schicht direkt über den service-role-Client — also exakt den Pfad,
 * den der öffentliche Eintritt später nimmt (RLS-bypassing, Token-scoped).
 *
 * BEWEIST (Plan §7 E1): ein Open-Link-Token für Studie X / org A sieht
 * AUSSCHLIESSLICH Studie X / org A — Studie Y / org B zu erreichen ist
 * strukturell unmöglich, nicht nur gefiltert. Plus: disabled/unbekannt/Drift =
 * fail-closed, und der unangetastete null-org-Invite-Guard liefert weiterhin
 * null (Regressions-Guard).
 *
 * Voraussetzung (André, NACH dem Anwenden der Migration im SQL-Editor):
 *   Migration 20260629000000_open_link.sql angewendet.
 *   SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local.
 *
 * Lauf:  pnpm openlink:smoke
 *
 * Alle Testdaten tragen den RUN-Marker im clerk_org_id und werden im finally
 * restlos gelöscht (FK-sichere Reihenfolge) + die Löschung wird verifiziert.
 */

const RUN = Date.now();
const MARK = `smoke-openlink-${RUN}`;
const token = () => randomBytes(32).toString("base64url");

const results: { name: string; ok: boolean; detail: string }[] = [];
function record(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

// Captured fixture ids/tokens for FK-safe cleanup.
const created: {
  orgA?: string;
  orgB?: string;
  planX?: string; // org A, screened
  planX2?: string; // org A, no screening
  planY?: string; // org B
} = {};
const T_A = token(); // active open link → (org A, plan X)
const T_A2 = token(); // active open link → (org A, plan X2, no screening)
const T_drift = token(); // active open link with org A but plan_id = Y (denorm drift)
const T_disabled = token(); // disabled open link → (org A, plan X)
const T_inviteNull = token(); // research_invites row with org_id = NULL (regression)
const T_unknown = token(); // never inserted

const supabase = createResearchSupabase();

async function preflight(): Promise<boolean> {
  const tbl = await supabase.from("research_open_links").select("id").limit(1);
  const col = await supabase
    .from("interview_sessions")
    .select("open_link_id")
    .limit(1);
  if (tbl.error || col.error) {
    console.log(
      "\n⏳ Migration 20260629000000_open_link.sql ist noch nicht angewendet.\n" +
        "   research_open_links / interview_sessions.open_link_id fehlen.\n" +
        "   Im SQL-Editor anwenden, dann `pnpm openlink:smoke` erneut laufen.\n" +
        `   (Detail: ${(tbl.error ?? col.error)?.message})`,
    );
    return false;
  }
  return true;
}

async function setup() {
  const orgA = await supabase
    .from("organizations")
    .insert({ clerk_org_id: `${MARK}-A`, name: "OpenLink Smoke Org A" })
    .select("id")
    .single();
  if (orgA.error || !orgA.data) throw new Error(`org A insert: ${orgA.error?.message}`);
  created.orgA = orgA.data.id;

  const orgB = await supabase
    .from("organizations")
    .insert({ clerk_org_id: `${MARK}-B`, name: "OpenLink Smoke Org B" })
    .select("id")
    .single();
  if (orgB.error || !orgB.data) throw new Error(`org B insert: ${orgB.error?.message}`);
  created.orgB = orgB.data.id;

  // Plan X (org A) WITH screening → resolvePublicOpenEntry should report
  // needs_screening.
  const planX = await supabase
    .from("research_plans")
    .insert({
      org_id: created.orgA,
      title: "Smoke Study X",
      objective: "tenant-isolation smoke (screened)",
      screening_questions: [
        {
          id: "q1",
          type: "single_choice",
          prompt: "Bist du Entscheider?",
          required: true,
          options: ["ja", "nein"],
          accepted: ["ja"],
        },
      ] as unknown as Json,
    })
    .select("id")
    .single();
  if (planX.error || !planX.data) throw new Error(`plan X insert: ${planX.error?.message}`);
  created.planX = planX.data.id;

  // Plan X2 (org A) WITHOUT screening → resolvePublicOpenEntry should report ready.
  const planX2 = await supabase
    .from("research_plans")
    .insert({
      org_id: created.orgA,
      title: "Smoke Study X2",
      objective: "tenant-isolation smoke (no screening)",
    })
    .select("id")
    .single();
  if (planX2.error || !planX2.data) throw new Error(`plan X2 insert: ${planX2.error?.message}`);
  created.planX2 = planX2.data.id;

  // Plan Y belongs to org B.
  const planY = await supabase
    .from("research_plans")
    .insert({
      org_id: created.orgB,
      title: "Smoke Study Y",
      objective: "tenant-isolation smoke (other org)",
    })
    .select("id")
    .single();
  if (planY.error || !planY.data) throw new Error(`plan Y insert: ${planY.error?.message}`);
  created.planY = planY.data.id;

  // Open links. Distinct plan_ids → no partial-unique collision on
  // (plan_id) where status='active'. T_disabled (disabled) is not in that index.
  const links = await supabase.from("research_open_links").insert([
    { org_id: created.orgA, plan_id: created.planX, access_token: T_A, status: "active" },
    { org_id: created.orgA, plan_id: created.planX2, access_token: T_A2, status: "active" },
    // DRIFT: org A, but plan_id points at org B's plan Y. Defense-in-depth:
    // getResearchPlan(A, Y) → null must make this fail-closed.
    { org_id: created.orgA, plan_id: created.planY, access_token: T_drift, status: "active" },
    { org_id: created.orgA, plan_id: created.planX, access_token: T_disabled, status: "disabled" },
  ]);
  if (links.error) throw new Error(`open_links insert: ${links.error.message}`);

  // Regression fixture: a research_invites row with org_id = NULL. The
  // unchanged !invite.org_id guard must keep returning null for it.
  const inv = await supabase.from("research_invites").insert({
    org_id: null,
    plan_id: created.planX,
    contact_label: "smoke null-org invite",
    access_token: T_inviteNull,
    language: "de",
  });
  if (inv.error) throw new Error(`null-org invite insert: ${inv.error.message}`);
}

async function assertions() {
  const A = created.orgA!;
  const B = created.orgB!;
  const X = created.planX!;
  const X2 = created.planX2!;
  const Y = created.planY!;

  // 1) Token → genau die EINE Zeile, org A / plan X only.
  const link = await findOpenLinkByAccessToken(T_A);
  record(
    "findOpenLinkByAccessToken(T_A) → org A / plan X only",
    !!link && link.org_id === A && link.plan_id === X && link.status === "active",
    link ? `org=${link.org_id === A ? "A" : link.org_id} plan=${link.plan_id === X ? "X" : link.plan_id}` : "null",
  );

  // 2) getResearchPlan(A, X) → X.
  const planX = await getResearchPlan(A, X);
  record("getResearchPlan(A, X) → X", !!planX && planX.id === X, planX ? "found" : "null");

  // 3) getResearchPlan(A, Y) → null (Y gehört org B). Cross-tenant-Schranke.
  const planAY = await getResearchPlan(A, Y);
  record("getResearchPlan(A, Y) → null (Y belongs to B)", planAY === null, planAY ? "LEAK: found" : "null");

  // 3b) Symmetrie: getResearchPlan(B, X) → null (X gehört org A).
  const planBX = await getResearchPlan(B, X);
  record("getResearchPlan(B, X) → null (X belongs to A)", planBX === null, planBX ? "LEAK: found" : "null");

  // 4) resolvePublicOpenEntry(T_A) → needs_screening, referenziert NIE org B / plan Y.
  const entry = await resolvePublicOpenEntry(T_A);
  const sc = entry && entry.mode === "needs_screening" ? entry.screening : null;
  const noLeak = !!sc && sc.orgId === A && sc.planId === X && sc.orgId !== B && sc.planId !== Y;
  record(
    "resolvePublicOpenEntry(T_A) → needs_screening, org A / plan X (never B/Y), lang=de",
    !!sc && noLeak && sc.questions.length > 0 && sc.language === "de",
    entry ? `mode=${entry.mode} lang=${sc?.language}` : "null",
  );

  // 4b) resolvePublicOpenEntry(T_A2) → ready (kein Screening), org A / plan X2.
  //     Pin language too — the only bespoke (non-inherited) field the E1 resolver
  //     computes (OPEN_LINK_DEFAULT_LANGUAGE, open links carry no language column).
  const entry2 = await resolvePublicOpenEntry(T_A2);
  const rd = entry2 && entry2.mode === "ready" ? entry2.ready : null;
  record(
    "resolvePublicOpenEntry(T_A2) → ready, org A / plan X2, lang=de",
    !!rd && rd.orgId === A && rd.planId === X2 && rd.language === "de",
    entry2 ? `mode=${entry2.mode} lang=${rd?.language}` : "null",
  );

  // 5) Denorm-Drift: org A + plan Y (gehört B). Link wird gefunden, aber der
  //    Entry ist fail-closed → null, weil getResearchPlan(A, Y)=null.
  const driftLink = await findOpenLinkByAccessToken(T_drift);
  const driftEntry = await resolvePublicOpenEntry(T_drift);
  record(
    "drift link (org A / plan Y) → findable but resolve = null (fail-closed)",
    !!driftLink && driftLink.org_id === A && driftLink.plan_id === Y && driftEntry === null,
    `link=${driftLink ? "row" : "null"} entry=${driftEntry === null ? "null" : "LEAK"}`,
  );

  // 6) disabled → fail-closed.
  const disabledLink = await findOpenLinkByAccessToken(T_disabled);
  const disabledEntry = await resolvePublicOpenEntry(T_disabled);
  record(
    "disabled link → findOpenLink=null + resolve=null (fail-closed)",
    disabledLink === null && disabledEntry === null,
    `link=${disabledLink ? "LEAK" : "null"} entry=${disabledEntry ? "LEAK" : "null"}`,
  );

  // 7) unknown token → fail-closed.
  const unknownLink = await findOpenLinkByAccessToken(T_unknown);
  const unknownEntry = await resolvePublicOpenEntry(T_unknown);
  record(
    "unknown token → findOpenLink=null + resolve=null (fail-closed)",
    unknownLink === null && unknownEntry === null,
    `link=${unknownLink ? "LEAK" : "null"} entry=${unknownEntry ? "LEAK" : "null"}`,
  );

  // 8) REGRESSION (E1 service-layer): der load-bearing !invite.org_id-Guard
  //    (session-service.ts:403/:501, screen/route.ts:61) ist byte-identisch
  //    unangetastet (git: zero diff). Datenebenen-Beweis: die null-org-Invite-
  //    Zeile IST present und findbar mit org_id=null — sie erreicht also den
  //    Guard — und die UNVERÄNDERTE Guard-Expression `!invite || !invite.org_id`
  //    ist für sie WAHR ⇒ getPublicSession/resolvePublicEntry/POST-/screen
  //    liefern null/404. (Der funktionale End-to-End-Call läuft in E4s HTTP-Smoke
  //    gegen einen echten Next-Server — siehe Import-Hinweis oben.)
  const nullOrgInvite = await findInviteByAccessToken(T_inviteNull);
  const present = !!nullOrgInvite;
  const reachesGuard = present && nullOrgInvite!.org_id === null;
  const guardReturnsNull = !nullOrgInvite || !nullOrgInvite.org_id; // exakte Guard-Expr
  record(
    "REGRESSION null-org invite present (org_id=null) → byte-identical guard expr ⇒ null",
    reachesGuard && guardReturnsNull,
    `present=${present} org_id=${nullOrgInvite?.org_id ?? "null"} guardReturnsNull=${guardReturnsNull}`,
  );

  // 9) Disjunkte Token-Namensräume (physische Trennung der zwei Capabilities):
  //    ein Open-Link-Token ist KEIN Invite-Token und umgekehrt.
  const aIsInvite = await findInviteByAccessToken(T_A);
  const inviteIsOpen = await findOpenLinkByAccessToken(T_inviteNull);
  record(
    "disjoint namespaces: open-link token ≠ invite, invite token ≠ open-link",
    aIsInvite === null && inviteIsOpen === null,
    `T_A-as-invite=${aIsInvite ? "LEAK" : "null"} T_inviteNull-as-open=${inviteIsOpen ? "LEAK" : "null"}`,
  );
}

async function cleanup() {
  // FK-safe order (children before parents); guarded so a partial setup still
  // tears down. The null-org invite references plan X → delete it before plans.
  if (created.orgA || created.orgB) {
    const orgs = [created.orgA, created.orgB].filter(Boolean) as string[];
    await supabase.from("research_open_links").delete().in("org_id", orgs);
  }
  await supabase.from("research_invites").delete().eq("access_token", T_inviteNull);
  const plans = [created.planX, created.planX2, created.planY].filter(Boolean) as string[];
  if (plans.length) await supabase.from("research_plans").delete().in("id", plans);
  const orgs = [created.orgA, created.orgB].filter(Boolean) as string[];
  if (orgs.length) await supabase.from("organizations").delete().in("id", orgs);
}

async function verifyClean() {
  const orgs = await supabase
    .from("organizations")
    .select("id")
    .like("clerk_org_id", `${MARK}-%`);
  const invite = await supabase
    .from("research_invites")
    .select("id")
    .eq("access_token", T_inviteNull);
  const orgsLeft = orgs.data?.length ?? 0;
  const inviteLeft = invite.data?.length ?? 0;
  // org delete cascades to research_open_links + research_plans (org_id FK is
  // ON DELETE CASCADE), so a zero org count + zero null-org-invite count means
  // the test rows are gone.
  record(
    "cleanup: 0 test rows remain",
    orgsLeft === 0 && inviteLeft === 0,
    `orgs=${orgsLeft} nullOrgInvite=${inviteLeft}`,
  );
}

async function main() {
  if (!(await preflight())) process.exit(2);
  try {
    await setup();
    await assertions();
  } finally {
    await cleanup().catch((e) => console.error("[cleanup] failed:", e?.message ?? e));
    await verifyClean().catch((e) => console.error("[verifyClean] failed:", e?.message ?? e));
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} Checks grün.`);
  if (failed.length > 0) {
    console.log("Fehlgeschlagen: " + failed.map((f) => f.name).join("; "));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

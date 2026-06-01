import { config } from "dotenv";

// Env wie der E1-Smoke (.env.local zuerst, dann .env). ESM linkt die Imports
// zuerst, dann laufen diese config()-Calls, danach erst die lazy
// createResearchSupabase()-Reads in den Funktionen. quiet → kein Banner.
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import type { Json } from "@/types/database";
import { createResearchSupabase } from "@/lib/research/db";
import {
  createOpenLink,
  setOpenLinkStatus,
  updateOpenLinkSettings,
  getOpenLinkForPlan,
  findOpenLinkByAccessToken,
  OPEN_LINK_DEFAULT_MAX_SESSIONS,
} from "@/lib/research/open-links";
// NB: session-service ist hier BEWUSST nicht importiert (zieht Clerk →
// next/navigation, crasht unter tsx --conditions=react-server). Wie der E1-Smoke
// trifft dieser die SERVICE-Schicht direkt über den service-role-Client — exakt
// den Pfad, den die E2-Route nach dem Auth-Gate nimmt.

/**
 * Offener Studien-Link — Etappe-2-Researcher-Verwaltungs-Smoke gegen die ECHTE
 * DB. Beweist die Verwaltungs-Funktionen + den MANDANTENTRENNUNGS-Kern von E2:
 *
 *   • createOpenLink stempelt die org_id der Zeile aus dem ARGUMENT (== org des
 *     Plans), NIE aus einem Body — und verweigert einen fremden/driftenden Plan
 *     (getResearchPlan-Gate) → KEINE Zeile.
 *   • Token wird server-seitig gemünzt (base64url), status='active', Default-Cap.
 *   • Idempotenz (kein zweiter aktiver Link, kein Token-Churn) → partial-unique.
 *   • Toggle active↔disabled (Kill-Switch) wirkt auf findOpenLinkByAccessToken.
 *   • updateOpenLinkSettings setzt Cap/Ablauf/Label, lässt status/token unberührt.
 *   • Alle Reads/Mutationen sind org-scoped: org B kann den Link von org A weder
 *     sehen noch togglen noch editieren (→ null), und der Link bleibt unberührt.
 *
 * Voraussetzung: Migration 20260629000000 angewendet, SUPABASE_SERVICE_ROLE_KEY
 * + NEXT_PUBLIC_SUPABASE_URL in .env.local. Lauf: `pnpm openlink:e2:smoke`.
 * Alle Testdaten tragen den RUN-Marker und werden im finally restlos gelöscht.
 */

const RUN = Date.now();
const MARK = `smoke-openlink-e2-${RUN}`;

const results: { name: string; ok: boolean; detail: string }[] = [];
function record(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

const created: {
  orgA?: string;
  orgB?: string;
  planX?: string; // org A, screened
  planX2?: string; // org A, no screening
  planY?: string; // org B
  planZ?: string; // org A, for the concurrent-create race guard
} = {};

const supabase = createResearchSupabase();

async function preflight(): Promise<boolean> {
  const tbl = await supabase.from("research_open_links").select("id").limit(1);
  if (tbl.error) {
    console.log(
      "\n⏳ Migration 20260629000000_open_link.sql noch nicht angewendet.\n" +
        `   (Detail: ${tbl.error.message})`,
    );
    return false;
  }
  return true;
}

async function setup() {
  const orgA = await supabase
    .from("organizations")
    .insert({ clerk_org_id: `${MARK}-A`, name: "OpenLink E2 Smoke Org A" })
    .select("id")
    .single();
  if (orgA.error || !orgA.data) throw new Error(`org A insert: ${orgA.error?.message}`);
  created.orgA = orgA.data.id;

  const orgB = await supabase
    .from("organizations")
    .insert({ clerk_org_id: `${MARK}-B`, name: "OpenLink E2 Smoke Org B" })
    .select("id")
    .single();
  if (orgB.error || !orgB.data) throw new Error(`org B insert: ${orgB.error?.message}`);
  created.orgB = orgB.data.id;

  const planX = await supabase
    .from("research_plans")
    .insert({
      org_id: created.orgA,
      title: "E2 Smoke Study X",
      objective: "researcher-management smoke (screened)",
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

  const planX2 = await supabase
    .from("research_plans")
    .insert({
      org_id: created.orgA,
      title: "E2 Smoke Study X2",
      objective: "researcher-management smoke (no screening, custom settings)",
    })
    .select("id")
    .single();
  if (planX2.error || !planX2.data) throw new Error(`plan X2 insert: ${planX2.error?.message}`);
  created.planX2 = planX2.data.id;

  const planY = await supabase
    .from("research_plans")
    .insert({
      org_id: created.orgB,
      title: "E2 Smoke Study Y",
      objective: "researcher-management smoke (other org)",
    })
    .select("id")
    .single();
  if (planY.error || !planY.data) throw new Error(`plan Y insert: ${planY.error?.message}`);
  created.planY = planY.data.id;

  const planZ = await supabase
    .from("research_plans")
    .insert({
      org_id: created.orgA,
      title: "E2 Smoke Study Z",
      objective: "researcher-management smoke (concurrent-create race guard)",
    })
    .select("id")
    .single();
  if (planZ.error || !planZ.data) throw new Error(`plan Z insert: ${planZ.error?.message}`);
  created.planZ = planZ.data.id;
}

const B64URL = /^[A-Za-z0-9_-]+$/;

async function assertions() {
  const A = created.orgA!;
  const B = created.orgB!;
  const X = created.planX!;
  const X2 = created.planX2!;
  const Z = created.planZ!;

  // 1) createOpenLink(A, X): org_id aus dem ARGUMENT (== Plan-org), Token
  //    server-seitig, status active, Default-Cap, valid_until/label null.
  const link = await createOpenLink(A, X);
  const tokenOk = !!link.access_token && link.access_token.length >= 40 && B64URL.test(link.access_token);
  record(
    "createOpenLink(A,X) → org_id==A (server-bound, NOT from body), plan==X, token minted, active, default cap",
    link.org_id === A &&
      link.plan_id === X &&
      link.status === "active" &&
      tokenOk &&
      link.max_sessions === OPEN_LINK_DEFAULT_MAX_SESSIONS &&
      link.valid_until === null &&
      link.label === null,
    `org=${link.org_id === A ? "A" : link.org_id} plan=${link.plan_id === X ? "X" : link.plan_id} status=${link.status} tokenLen=${link.access_token.length} cap=${link.max_sessions}`,
  );
  const firstId = link.id;
  const firstToken = link.access_token;

  // 1b) DB-Direktbeleg: die Zeile trägt org_id == A in der Tabelle (nicht nur im
  //     Rückgabe-Objekt). Kein org_id aus einem Request irgendwo.
  const dbRow = await supabase
    .from("research_open_links")
    .select("org_id, plan_id, status, access_token")
    .eq("id", firstId)
    .single();
  record(
    "DB row of created link has org_id==A, plan_id==X (denormalized from plan, server-side)",
    !dbRow.error && dbRow.data?.org_id === A && dbRow.data?.plan_id === X && dbRow.data?.status === "active",
    dbRow.data ? `org=${dbRow.data.org_id === A ? "A" : dbRow.data.org_id}` : `err=${dbRow.error?.message}`,
  );

  // 2) Idempotenz: zweiter create → SELBE Zeile (kein zweiter aktiver Link, kein
  //    Token-Churn) → respektiert research_open_links_plan_active_idx.
  const link2 = await createOpenLink(A, X, { maxSessions: 7, label: "ignored" });
  record(
    "createOpenLink(A,X) again → idempotent: same id, same token (partial-unique respected, no churn)",
    link2.id === firstId && link2.access_token === firstToken && link2.max_sessions === OPEN_LINK_DEFAULT_MAX_SESSIONS,
    `sameId=${link2.id === firstId} sameToken=${link2.access_token === firstToken}`,
  );

  // 2b) genau EINE active-Zeile für Plan X.
  const activeCount = await supabase
    .from("research_open_links")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", X)
    .eq("status", "active");
  record(
    "exactly one active open-link row for plan X",
    activeCount.count === 1,
    `count=${activeCount.count}`,
  );

  // 3) getOpenLinkForPlan(A, X) → der aktive Link.
  const got = await getOpenLinkForPlan(A, X);
  record(
    "getOpenLinkForPlan(A,X) → the active link",
    !!got && got.id === firstId && got.status === "active",
    got ? `id-match=${got.id === firstId}` : "null",
  );

  // 4) createOpenLink mit expliziten Settings (Plan X2, kein Screening — der
  //    Service erzwingt KEIN Screening; das ist die UI-Leitplanke). Custom Cap +
  //    Ablauf + Label werden übernommen.
  const linkX2 = await createOpenLink(A, X2, {
    maxSessions: 25,
    validUntil: "2026-07-01",
    label: "LinkedIn-Post",
  });
  record(
    "createOpenLink(A,X2,{cap:25, valid:2026-07-01, label}) → custom settings honored",
    linkX2.org_id === A &&
      linkX2.plan_id === X2 &&
      linkX2.max_sessions === 25 &&
      typeof linkX2.valid_until === "string" &&
      linkX2.valid_until.slice(0, 10) === "2026-07-01" &&
      linkX2.label === "LinkedIn-Post",
    `cap=${linkX2.max_sessions} valid=${linkX2.valid_until?.slice(0, 10)} label=${linkX2.label}`,
  );

  // 5) updateOpenLinkSettings(A, X): Cap/Ablauf/Label setzen, status+token UNBERÜHRT.
  const upd = await updateOpenLinkSettings(A, X, {
    maxSessions: 50,
    validUntil: "2026-08-15",
    label: "Community",
  });
  record(
    "updateOpenLinkSettings(A,X) → cap/valid/label set, status+token unchanged",
    !!upd &&
      upd.id === firstId &&
      upd.access_token === firstToken &&
      upd.status === "active" &&
      upd.max_sessions === 50 &&
      upd.valid_until?.slice(0, 10) === "2026-08-15" &&
      upd.label === "Community",
    upd ? `cap=${upd.max_sessions} valid=${upd.valid_until?.slice(0, 10)} status=${upd.status} sameToken=${upd.access_token === firstToken}` : "null",
  );

  // 6) setOpenLinkStatus(A, X, 'disabled') = Kill-Switch → findOpenLinkByAccessToken
  //    ist fail-closed (status='active') → der öffentliche Eintritt ist sofort tot.
  const disabled = await setOpenLinkStatus(A, X, "disabled");
  const lookupAfterDisable = await findOpenLinkByAccessToken(firstToken);
  record(
    "setOpenLinkStatus(A,X,'disabled') → status disabled + findOpenLinkByAccessToken=null (revoked)",
    !!disabled && disabled.status === "disabled" && lookupAfterDisable === null,
    `status=${disabled?.status} publicLookup=${lookupAfterDisable ? "STILL LIVE (LEAK)" : "null"}`,
  );

  // 7) setOpenLinkStatus(A, X, 'active') → reaktiviert, gleicher Token wieder live.
  const reenabled = await setOpenLinkStatus(A, X, "active");
  const lookupAfterEnable = await findOpenLinkByAccessToken(firstToken);
  record(
    "setOpenLinkStatus(A,X,'active') → re-activated, same token live again (toggle both ways)",
    !!reenabled && reenabled.status === "active" && reenabled.access_token === firstToken && !!lookupAfterEnable && lookupAfterEnable.id === firstId,
    `status=${reenabled?.status} publicLookup=${lookupAfterEnable ? "live" : "null"}`,
  );

  // 7b) Nebenläufigkeit: zwei gleichzeitige createOpenLink(A, Z) — beide
  //     passieren den findActiveOpenLinkRow-Check, der zweite Insert verletzt
  //     das partial-unique. Der Fix fängt das als idempotenten Re-Use ab: KEIN
  //     Throw, beide liefern denselben aktiven Link, genau EINE aktive Zeile.
  const [conc1, conc2] = await Promise.all([
    createOpenLink(A, Z),
    createOpenLink(A, Z),
  ]);
  const concActive = await supabase
    .from("research_open_links")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", Z)
    .eq("status", "active");
  record(
    "concurrent createOpenLink(A,Z) ×2 → no throw, same active link, exactly one active row (race-safe idempotency)",
    conc1.id === conc2.id &&
      conc1.access_token === conc2.access_token &&
      conc1.status === "active" &&
      concActive.count === 1,
    `sameId=${conc1.id === conc2.id} sameToken=${conc1.access_token === conc2.access_token} activeRows=${concActive.count}`,
  );

  // 8) MANDANTENTRENNUNG (Kern): createOpenLink(B, X) — Plan X gehört org A.
  //    getResearchPlan(B, X)=null ⇒ createOpenLink wirft, KEINE Zeile entsteht.
  let threw = false;
  try {
    await createOpenLink(B, X);
  } catch {
    threw = true;
  }
  const orgBRowsForX = await supabase
    .from("research_open_links")
    .select("id", { count: "exact", head: true })
    .eq("org_id", B)
    .eq("plan_id", X);
  record(
    "createOpenLink(B,X) → throws (foreign plan, getResearchPlan gate) AND creates NO row with org_id=B",
    threw && orgBRowsForX.count === 0,
    `threw=${threw} orgB-rows-for-X=${orgBRowsForX.count}`,
  );

  // 9) Org-Scoping der Reads/Mutationen: org B sieht/togglet/editiert org A's Link NICHT.
  const getCross = await getOpenLinkForPlan(B, X);
  const toggleCross = await setOpenLinkStatus(B, X, "disabled");
  const updateCross = await updateOpenLinkSettings(B, X, { maxSessions: 1 });
  const stillActive = await getOpenLinkForPlan(A, X);
  record(
    "org B cannot read/toggle/edit org A's link (all null) AND org A's link stays active+intact",
    getCross === null &&
      toggleCross === null &&
      updateCross === null &&
      !!stillActive &&
      stillActive.id === firstId &&
      stillActive.status === "active" &&
      stillActive.max_sessions === 50,
    `get=${getCross ? "LEAK" : "null"} toggle=${toggleCross ? "LEAK" : "null"} update=${updateCross ? "LEAK" : "null"} A-status=${stillActive?.status} A-cap=${stillActive?.max_sessions}`,
  );
}

async function cleanup() {
  const orgs = [created.orgA, created.orgB].filter(Boolean) as string[];
  if (orgs.length) {
    // org-delete cascadet research_open_links + research_plans (org_id FK ON
    // DELETE CASCADE). open_links zuerst explizit (defensiv, falls Cascade je
    // gelockert wird).
    await supabase.from("research_open_links").delete().in("org_id", orgs);
    const plans = [created.planX, created.planX2, created.planY, created.planZ].filter(Boolean) as string[];
    if (plans.length) await supabase.from("research_plans").delete().in("id", plans);
    await supabase.from("organizations").delete().in("id", orgs);
  }
}

async function verifyClean() {
  const orgs = await supabase
    .from("organizations")
    .select("id")
    .like("clerk_org_id", `${MARK}-%`);
  const left = orgs.data?.length ?? 0;
  record("cleanup: 0 test orgs remain (cascades open_links + plans)", left === 0, `orgs=${left}`);
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

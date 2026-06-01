import { config } from "dotenv";

// Same env-load order as the open-link smokes: .env.local first, then .env.
// The imported service modules read SUPABASE_* lazily inside their functions
// (never at import time), so env is in place before the first client is built.
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { randomBytes } from "node:crypto";

import type { Json } from "@/types/database";
import { createResearchSupabase } from "@/lib/research/db";
import {
  countCompletedSessionsForPlan,
  createResearchPlan,
  listResearchPlans,
} from "@/lib/research/plans-service";

/**
 * Market-Research Phase M3 — Live-DB-Smoke gegen die ECHTE DB. Vorbild:
 * scripts/open-link-smoke.ts. Trifft die SERVICE-Schicht direkt (service-role-
 * Client), genau die Funktionen, die der MR-Bereich + der Ziel-Pool nutzen.
 *
 * BEWEIST (separation plan §5 M3 + §7):
 *   (A) createResearchPlan mit studyType='market_research' → study_type-Spalte
 *       in der DB = 'market_research'; OHNE studyType (Discovery) → Spalte
 *       weggelassen → DB-DEFAULT 'product_discovery' (byte-identisches Anlegen).
 *   (B) listResearchPlans(org, type) trennt die zwei Bereiche sauber; OHNE
 *       Filter liefert es BEIDE (der unfilterte Pfad bleibt byte-identisch).
 *   (C) countCompletedSessionsForPlan zählt NUR status='completed', strikt
 *       org+plan-scoped — und ist GETRENNT vom all-status-Nenner (§7: die drei
 *       Quota-Begriffe koexistieren, nicht vereinheitlicht).
 *
 * Voraussetzung: Migration 20260630000000 (study_type) angewendet — auf main
 * laut Memory live + backfilled. SUPABASE_SERVICE_ROLE_KEY +
 * NEXT_PUBLIC_SUPABASE_URL in .env.local.
 *
 * Lauf:  pnpm mr:m3:smoke
 *
 * Alle Testdaten tragen den RUN-Marker im clerk_org_id; im finally restlos
 * gelöscht (org-delete CASCADE → plans + interview_sessions) + verifiziert.
 */

const RUN = Date.now();
const MARK = `smoke-mr-m3-${RUN}`;
const tok = () => randomBytes(24).toString("base64url");

const results: { name: string; ok: boolean; detail: string }[] = [];
function record(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(
    `${ok ? "✅ PASS" : "❌ FAIL"}  ${name}${detail ? "  — " + detail : ""}`,
  );
}

const ids: {
  orgA?: string;
  orgB?: string;
  marketPlan?: string; // org A, study_type market_research
  discoveryPlan?: string; // org A, study_type product_discovery (default)
  explicitDiscovery?: string; // org A, explicit product_discovery
  emptyPlan?: string; // org A, no sessions
  planB?: string; // org B (cross-org)
} = {};

const supabase = createResearchSupabase();

async function preflight(): Promise<boolean> {
  // study_type column present?
  const col = await supabase
    .from("research_plans")
    .select("study_type")
    .limit(1);
  if (col.error) {
    console.log(
      "\n⏳ research_plans.study_type fehlt — Migration 20260630000000 anwenden.\n" +
        `   (Detail: ${col.error.message})`,
    );
    return false;
  }
  return true;
}

async function mkOrg(suffix: string): Promise<string> {
  const r = await supabase
    .from("organizations")
    .insert({ clerk_org_id: `${MARK}-${suffix}`, name: `MR M3 Smoke ${suffix}` })
    .select("id")
    .single();
  if (r.error || !r.data) throw new Error(`org ${suffix} insert: ${r.error?.message}`);
  return r.data.id;
}

/** Direct study_type read for a plan id (bypasses the service mapper so we read
 *  the raw column value the DB actually persisted). */
async function rawStudyType(planId: string): Promise<string | null> {
  const r = await supabase
    .from("research_plans")
    .select("study_type")
    .eq("id", planId)
    .maybeSingle();
  return (r.data?.study_type as string | undefined) ?? null;
}

async function mkSession(
  orgId: string,
  planId: string,
  status: "open" | "completed" | "abandoned",
): Promise<void> {
  const r = await supabase.from("interview_sessions").insert({
    org_id: orgId,
    plan_id: planId,
    access_token: tok(),
    status,
    kind: "research",
    mode: "text",
    language: "de",
    conversation: [] as unknown as Json,
  });
  if (r.error) throw new Error(`session insert (${status}): ${r.error.message}`);
}

async function setup() {
  ids.orgA = await mkOrg("A");
  ids.orgB = await mkOrg("B");

  // (A) market create — service path with the discriminator.
  const market = await createResearchPlan(ids.orgA, {
    title: "Smoke Market Campaign",
    objective: "Markt-Outreach Preis-Sensitivität",
    topics: [],
    sampleTarget: 5,
    studyType: "market_research",
  });
  ids.marketPlan = market.id;

  // (A) discovery create — NO studyType → DB default product_discovery.
  const discovery = await createResearchPlan(ids.orgA, {
    title: "Smoke Discovery Plan",
    objective: "Product feedback retro",
    topics: [],
  });
  ids.discoveryPlan = discovery.id;

  // explicit product_discovery (should also omit the column → default).
  const explicit = await createResearchPlan(ids.orgA, {
    title: "Smoke Explicit Discovery",
    objective: "explicit pd",
    topics: [],
    studyType: "product_discovery",
  });
  ids.explicitDiscovery = explicit.id;

  // empty market plan (no sessions) for the zero-count assertion.
  const empty = await createResearchPlan(ids.orgA, {
    title: "Smoke Empty Market",
    objective: "no sessions",
    topics: [],
    studyType: "market_research",
  });
  ids.emptyPlan = empty.id;

  // org B plan (cross-org isolation).
  const planB = await createResearchPlan(ids.orgB, {
    title: "Smoke Org B Market",
    objective: "other org",
    topics: [],
    studyType: "market_research",
  });
  ids.planB = planB.id;

  // (C) sessions on the market plan: 2 completed + 1 open + 1 abandoned.
  await mkSession(ids.orgA, ids.marketPlan, "completed");
  await mkSession(ids.orgA, ids.marketPlan, "completed");
  await mkSession(ids.orgA, ids.marketPlan, "open");
  await mkSession(ids.orgA, ids.marketPlan, "abandoned");
  // a completed session on the DISCOVERY plan (same org) — must NOT count.
  await mkSession(ids.orgA, ids.discoveryPlan, "completed");
  // a completed session on org B's plan — must NOT count.
  await mkSession(ids.orgB, ids.planB, "completed");
}

async function assertions() {
  const A = ids.orgA!;
  const market = ids.marketPlan!;
  const discovery = ids.discoveryPlan!;
  const explicit = ids.explicitDiscovery!;
  const empty = ids.emptyPlan!;

  // (A) study_type stamped correctly.
  record(
    "createResearchPlan(studyType=market_research) → DB study_type='market_research'",
    (await rawStudyType(market)) === "market_research",
    `study_type=${await rawStudyType(market)}`,
  );
  record(
    "createResearchPlan(no studyType) → DB DEFAULT 'product_discovery' (byte-identical discovery create)",
    (await rawStudyType(discovery)) === "product_discovery",
    `study_type=${await rawStudyType(discovery)}`,
  );
  record(
    "createResearchPlan(studyType=product_discovery) → 'product_discovery'",
    (await rawStudyType(explicit)) === "product_discovery",
    `study_type=${await rawStudyType(explicit)}`,
  );

  // (B) listResearchPlans separation.
  const marketList = await listResearchPlans(A, "market_research");
  const marketIds = new Set(marketList.map((p) => p.id));
  record(
    "listResearchPlans(market_research) → market plans only (no discovery leak)",
    marketIds.has(market) &&
      marketIds.has(empty) &&
      !marketIds.has(discovery) &&
      !marketIds.has(explicit),
    `ids=${marketList.length}`,
  );
  const discoveryList = await listResearchPlans(A, "product_discovery");
  const discIds = new Set(discoveryList.map((p) => p.id));
  record(
    "listResearchPlans(product_discovery) → discovery plans only (no market leak)",
    discIds.has(discovery) &&
      discIds.has(explicit) &&
      !discIds.has(market) &&
      !discIds.has(empty),
    `ids=${discoveryList.length}`,
  );
  const allList = await listResearchPlans(A);
  const allIds = new Set(allList.map((p) => p.id));
  record(
    "listResearchPlans(no filter) → BOTH types (unfiltered path byte-identical)",
    allIds.has(market) &&
      allIds.has(discovery) &&
      allIds.has(explicit) &&
      allIds.has(empty),
    `ids=${allList.length}`,
  );

  // (C) countCompletedSessionsForPlan — completed-only, org+plan-scoped.
  const completed = await countCompletedSessionsForPlan(A, market);
  record(
    "countCompletedSessionsForPlan(market) → 2 (only status='completed', org+plan-scoped)",
    completed === 2,
    `count=${completed} (inserted: 2 completed + 1 open + 1 abandoned on this plan; +1 completed on discovery plan; +1 completed in org B — none counted)`,
  );
  record(
    "countCompletedSessionsForPlan(empty market plan) → 0",
    (await countCompletedSessionsForPlan(A, empty)) === 0,
    `count=${await countCompletedSessionsForPlan(A, empty)}`,
  );

  // §7 three-numbers separation: completed-only counter ≠ all-status counter.
  const allStatus = await supabase
    .from("interview_sessions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", A)
    .eq("plan_id", market);
  const allCount = allStatus.count ?? -1;
  record(
    "§7: completed counter (2) is DISTINCT from all-status counter (4) — not conflated with the E5 spend-cap nenner",
    completed === 2 && allCount === 4 && completed < allCount,
    `completed=${completed} allStatus=${allCount}`,
  );

  // org-scope: org B can't see org A's market plan completed count via wrong org.
  record(
    "countCompletedSessionsForPlan(orgB, market) → 0 (org-scoped, cross-tenant safe)",
    (await countCompletedSessionsForPlan(ids.orgB!, market)) === 0,
    `count=${await countCompletedSessionsForPlan(ids.orgB!, market)}`,
  );
}

async function cleanup() {
  // org delete CASCADEs interview_sessions (org_id FK ON DELETE CASCADE) and
  // research_plans (org_id FK ON DELETE CASCADE). One delete per org clears all.
  const orgs = [ids.orgA, ids.orgB].filter(Boolean) as string[];
  if (orgs.length) await supabase.from("organizations").delete().in("id", orgs);
}

async function verifyClean() {
  const orgs = await supabase
    .from("organizations")
    .select("id")
    .like("clerk_org_id", `${MARK}-%`);
  const orgsLeft = orgs.data?.length ?? 0;
  // Belt-and-suspenders: also confirm no plan / session rows survive for the
  // captured plan ids (would only matter if the CASCADE were missing).
  const planIds = [
    ids.marketPlan,
    ids.discoveryPlan,
    ids.explicitDiscovery,
    ids.emptyPlan,
    ids.planB,
  ].filter(Boolean) as string[];
  const plansLeft = planIds.length
    ? (
        await supabase.from("research_plans").select("id").in("id", planIds)
      ).data?.length ?? 0
    : 0;
  const sessLeft = planIds.length
    ? (
        await supabase
          .from("interview_sessions")
          .select("id")
          .in("plan_id", planIds)
      ).data?.length ?? 0
    : 0;
  record(
    "cleanup: 0 test rows remain (orgs + plans + sessions)",
    orgsLeft === 0 && plansLeft === 0 && sessLeft === 0,
    `orgs=${orgsLeft} plans=${plansLeft} sessions=${sessLeft}`,
  );
}

async function main() {
  if (!(await preflight())) process.exit(2);
  try {
    await setup();
    await assertions();
  } finally {
    await cleanup().catch((e) => console.error("[cleanup] failed:", e?.message ?? e));
    await verifyClean().catch((e) =>
      console.error("[verifyClean] failed:", e?.message ?? e),
    );
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

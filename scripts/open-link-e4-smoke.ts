import { config } from "dotenv";

// Env wie der E1/E2-Smoke (.env.local zuerst, dann .env).
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import type { Json } from "@/types/database";
import { createResearchSupabase } from "@/lib/research/db";
// NB: session-service / research-orchestration werden BEWUSST nicht importiert
// (server-only + react-server-Kontext crashen unter tsx). Dieser Smoke fährt die
// ECHTE Route über HTTP gegen `next start` und prüft das Ergebnis direkt in der
// DB über den service-role-Client. Das ist die faithful E4-Verifikation
// (Eintritts-Naht + Opus-Turn + Hand-off laufen IM Next-Runtime, nicht hier).

/**
 * Offener Studien-Link — Etappe-4-Verdrahtungs-Smoke (ende-zu-ende, Live-DB).
 *
 * Beweist die drei kritischen Invarianten + den vollen Qualifiziert/Abgewiesen-
 * Pfad gegen die ECHTE Route POST /api/interview/open/[token]/screen:
 *
 *   1. Der OPEN-LINK-TOKEN wird NIE zum Session-Token: jeder qualifizierte
 *      Walk-in bekommt einen FRISCHEN access_token (!= T_A), N Walk-ins ⇒ N
 *      DISTINKTE Sessions. KEIN interview_sessions.access_token gleicht je einem
 *      Open-Link-Token.
 *   2. MANDANTENTRENNUNG: org_id + plan_id stammen NUR aus der Link-Zeile; ein
 *      bösartiger Body (orgId/planId/openLinkId) wird ignoriert (Zod strip).
 *      T_B erzeugt NUR org-B-Sessions. Der null-org-Invite-Pfad bleibt 404.
 *   3. Qualifiziert → Session (invite_id NULL, open_link_id gesetzt, org_id NOT
 *      NULL, screening_answers, frischer Token) + qualified-Quote; Abgewiesen →
 *      KEINE Session, KEIN Opus-Turn, nur rejected-Quote.
 *
 * Zusätzlich: harte Screening-Pflicht (Plan ohne Screening → Eintritt verweigert,
 * KEINE Session), valid_until ENFORCED (abgelaufen → keine Session), Refresh auf
 * einem Session-Token dupliziert nicht, unbekannter Token → 404.
 *
 * Realer Opus-Turn fällt NUR im Qualifiziert-Fall an → bewusst sparsam:
 * 2× T_A (distinkt) + 1× T_B = 3 Opus-Turns gesamt.
 *
 * Voraussetzung: Migration 20260629000000 angewendet; `next build` gelaufen;
 * `next start` läuft unter OPENLINK_E4_BASE_URL (Default http://localhost:4123);
 * SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL + ANTHROPIC_API_KEY in
 * .env.local. Alle Testdaten tragen den RUN-Marker und werden im finally
 * restlos gelöscht (+ verifyClean auf 0).
 */

const BASE = process.env.OPENLINK_E4_BASE_URL ?? "http://localhost:4123";
const RUN = Date.now();
const MARK = `smoke-openlink-e4-${RUN}`;

const results: { name: string; ok: boolean; detail: string }[] = [];
function record(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

const supabase = createResearchSupabase();

const SCREENING_Q: Json = [
  {
    id: "q1",
    type: "single_choice",
    prompt: "Bist du Entscheider?",
    required: true,
    options: ["ja", "nein"],
    accepted: ["ja"],
  },
] as unknown as Json;

const ids: {
  orgA?: string;
  orgB?: string;
  planX?: string; // org A, screened
  planX2?: string; // org A, NO screening
  planX3?: string; // org A, screened, link expired
  planY?: string; // org B, screened
  linkA?: string;
  linkA2?: string;
  linkA3?: string;
  linkB?: string;
} = {};

const tok: {
  TA?: string;
  TA2?: string;
  TA3?: string;
  TB?: string;
  TNULL?: string;
} = {};

// Session tokens we mint during the run — collected for the global
// "no session token equals any open-link token" assertion + cleanup.
const sessionTokens: string[] = [];

function mintToken(): string {
  // 256-bit base64url, same shape as the app — value is irrelevant, only
  // uniqueness + format matter for a fixture.
  const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
  return randomBytes(32).toString("base64url");
}

async function preflight(): Promise<boolean> {
  const tbl = await supabase.from("research_open_links").select("id").limit(1);
  if (tbl.error) {
    console.log(
      "\n⏳ Migration 20260629000000_open_link.sql noch nicht angewendet.\n" +
        `   (Detail: ${tbl.error.message})`,
    );
    return false;
  }
  try {
    const res = await fetch(`${BASE}/`, { method: "GET" });
    // Any HTTP response (even 404) proves the server is up.
    void res.status;
  } catch (e) {
    console.log(
      `\n⏳ Server unter ${BASE} nicht erreichbar. Starte zuerst \`next start\`.\n` +
        `   (Detail: ${(e as Error).message})`,
    );
    return false;
  }
  return true;
}

async function insertOrg(suffix: string, name: string): Promise<string> {
  const r = await supabase
    .from("organizations")
    .insert({ clerk_org_id: `${MARK}-${suffix}`, name })
    .select("id")
    .single();
  if (r.error || !r.data) throw new Error(`org ${suffix} insert: ${r.error?.message}`);
  return r.data.id;
}

async function insertPlan(
  orgId: string,
  title: string,
  screened: boolean,
): Promise<string> {
  const r = await supabase
    .from("research_plans")
    .insert({
      org_id: orgId,
      title,
      objective: "E4 wiring smoke",
      ...(screened ? { screening_questions: SCREENING_Q } : {}),
    })
    .select("id")
    .single();
  if (r.error || !r.data) throw new Error(`plan ${title} insert: ${r.error?.message}`);
  return r.data.id;
}

async function insertLink(
  orgId: string,
  planId: string,
  validUntil: string | null,
): Promise<{ id: string; token: string }> {
  const token = mintToken();
  const r = await supabase
    .from("research_open_links")
    .insert({
      org_id: orgId,
      plan_id: planId,
      access_token: token,
      status: "active",
      max_sessions: null, // E5-Cap NICHT Teil von E4
      valid_until: validUntil,
    })
    .select("id")
    .single();
  if (r.error || !r.data) throw new Error(`open_link insert: ${r.error?.message}`);
  return { id: r.data.id, token };
}

async function setup() {
  ids.orgA = await insertOrg("A", "OpenLink E4 Smoke Org A");
  ids.orgB = await insertOrg("B", "OpenLink E4 Smoke Org B");

  ids.planX = await insertPlan(ids.orgA, "E4 Study X (screened)", true);
  ids.planX2 = await insertPlan(ids.orgA, "E4 Study X2 (no screening)", false);
  ids.planX3 = await insertPlan(ids.orgA, "E4 Study X3 (expired link)", true);
  ids.planY = await insertPlan(ids.orgB, "E4 Study Y (org B, screened)", true);

  const a = await insertLink(ids.orgA, ids.planX, null);
  ids.linkA = a.id;
  tok.TA = a.token;

  const a2 = await insertLink(ids.orgA, ids.planX2, null);
  ids.linkA2 = a2.id;
  tok.TA2 = a2.token;

  const a3 = await insertLink(ids.orgA, ids.planX3, "2020-01-01T00:00:00.000Z");
  ids.linkA3 = a3.id;
  tok.TA3 = a3.token;

  const b = await insertLink(ids.orgB, ids.planY, null);
  ids.linkB = b.id;
  tok.TB = b.token;

  // Null-org invite (org_id = NULL) — regression guard for the byte-identical
  // !invite.org_id guard on the SEPARATE per-invite path. plan_id is NOT NULL,
  // so we point it at planX; the guard 404s on org_id = null regardless.
  tok.TNULL = mintToken();
  const inv = await supabase
    .from("research_invites")
    .insert({
      org_id: null,
      plan_id: ids.planX,
      contact_label: `${MARK}-nullorg`,
      mode_preference: "text",
      status: "pending",
      access_token: tok.TNULL,
    })
    .select("id");
  if (inv.error) throw new Error(`null-org invite insert: ${inv.error.message}`);
}

type ScreenResponse = {
  status: number;
  body: {
    qualified?: boolean;
    sessionToken?: string;
    available?: boolean;
    error?: string;
  };
};

async function postScreen(
  token: string,
  body: unknown,
): Promise<ScreenResponse> {
  const res = await fetch(`${BASE}/api/interview/open/${token}/screen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = (await res.json().catch(() => ({}))) as ScreenResponse["body"];
  return { status: res.status, body: parsed };
}

async function sessionsForLink(linkId: string) {
  return supabase
    .from("interview_sessions")
    .select("id, org_id, plan_id, invite_id, open_link_id, access_token, screening_answers, kind")
    .eq("open_link_id", linkId);
}

async function quoteCount(
  orgId: string,
  planId: string,
  verdict: "qualified" | "rejected",
): Promise<number> {
  const r = await supabase
    .from("research_screening_responses")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .eq("verdict", verdict);
  return r.count ?? -1;
}

async function assertions() {
  const A = ids.orgA!;
  const B = ids.orgB!;
  const X = ids.planX!;
  const Y = ids.planY!;
  const TA = tok.TA!;
  const TB = tok.TB!;

  // ── 1) Qualifizierte Walk-ins auf T_A: N=2 distinkte Sessions, frische Token.
  const q1 = await postScreen(TA, { answers: { q1: "ja" } });
  const q2 = await postScreen(TA, { answers: { q1: "ja" } });
  const ts1 = q1.body.sessionToken;
  const ts2 = q2.body.sessionToken;
  if (ts1) sessionTokens.push(ts1);
  if (ts2) sessionTokens.push(ts2);

  record(
    "qualified ×2 on T_A → 200 {qualified:true, sessionToken} each; FRESH token != T_A and != each other",
    q1.status === 200 &&
      q1.body.qualified === true &&
      !!ts1 &&
      ts1 !== TA &&
      q2.status === 200 &&
      q2.body.qualified === true &&
      !!ts2 &&
      ts2 !== TA &&
      ts1 !== ts2,
    `s1=${q1.status} t1!=TA=${ts1 !== TA} s2=${q2.status} t2!=TA=${ts2 !== TA} distinct=${ts1 !== ts2}`,
  );

  // DB: exactly two sessions attributed to linkA, each correctly stamped.
  const sLinkA = await sessionsForLink(ids.linkA!);
  const rows = sLinkA.data ?? [];
  const allStamped =
    rows.length === 2 &&
    rows.every(
      (r) =>
        r.org_id === A &&
        r.plan_id === X &&
        r.invite_id === null &&
        r.open_link_id === ids.linkA &&
        r.kind === "research" &&
        r.access_token !== TA &&
        r.screening_answers !== null &&
        (r.screening_answers as { q1?: string }).q1 === "ja",
    );
  record(
    "DB: 2 sessions for linkA — org_id=A, plan_id=X, invite_id=NULL, open_link_id=linkA, screening_answers set, token!=T_A",
    allStamped,
    `count=${rows.length} stamped=${allStamped} tokens=[${rows.map((r) => (r.access_token === TA ? "==T_A(LEAK)" : "fresh")).join(",")}]`,
  );

  // ── 2) Abgewiesener Walk-in auf T_A → keine Session, nur rejected-Quote.
  const rej = await postScreen(TA, { answers: { q1: "nein" } });
  const sLinkA_after = await sessionsForLink(ids.linkA!);
  record(
    "rejected on T_A → 200 {qualified:false}, NO sessionToken, NO new session (still 2 for linkA)",
    rej.status === 200 &&
      rej.body.qualified === false &&
      rej.body.sessionToken === undefined &&
      (sLinkA_after.data?.length ?? -1) === 2,
    `status=${rej.status} qualified=${rej.body.qualified} sessions=${sLinkA_after.data?.length}`,
  );

  const qQuoteAX = await quoteCount(A, X, "qualified");
  const rQuoteAX = await quoteCount(A, X, "rejected");
  record(
    "quotes (A,X): qualified==2 (one per minted session, status==='created') AND rejected==1",
    qQuoteAX === 2 && rQuoteAX === 1,
    `qualified=${qQuoteAX} rejected=${rQuoteAX}`,
  );

  // ── 3) Refresh auf einem SESSION-Token + auf der Open-Page → keine Dup-Session.
  if (ts1) {
    await fetch(`${BASE}/interview/${ts1}`, { method: "GET" }).catch(() => null);
  }
  await fetch(`${BASE}/interview/open/${TA}`, { method: "GET" }).catch(() => null);
  const sLinkA_refresh = await sessionsForLink(ids.linkA!);
  record(
    "refresh on a session token + reload of the open page → no new session (still 2 for linkA)",
    (sLinkA_refresh.data?.length ?? -1) === 2,
    `sessions=${sLinkA_refresh.data?.length}`,
  );

  // ── 4) Harte Screening-Pflicht: Plan OHNE Screening → Eintritt verweigert.
  const noScreen = await postScreen(tok.TA2!, { answers: {} });
  const sLinkA2 = await sessionsForLink(ids.linkA2!);
  const qX2 = await quoteCount(A, ids.planX2!, "qualified");
  const rX2 = await quoteCount(A, ids.planX2!, "rejected");
  record(
    "no-screening open link (T_A2) → 403 {available:false}, NO session, NO quote (hard screening requirement)",
    noScreen.status === 403 &&
      noScreen.body.available === false &&
      (sLinkA2.data?.length ?? -1) === 0 &&
      qX2 === 0 &&
      rX2 === 0,
    `status=${noScreen.status} avail=${noScreen.body.available} sessions=${sLinkA2.data?.length} quotes=${qX2}/${rX2}`,
  );

  // ── 5) valid_until ENFORCED: abgelaufener Link → keine Session.
  const expired = await postScreen(tok.TA3!, { answers: { q1: "ja" } });
  const sLinkA3 = await sessionsForLink(ids.linkA3!);
  const qX3 = await quoteCount(A, ids.planX3!, "qualified");
  record(
    "expired link (T_A3, valid_until past) → 403 {available:false}, NO session, NO qualified-quote (enforced, not just shown)",
    expired.status === 403 &&
      expired.body.available === false &&
      (sLinkA3.data?.length ?? -1) === 0 &&
      qX3 === 0,
    `status=${expired.status} avail=${expired.body.available} sessions=${sLinkA3.data?.length} qualifiedQuote=${qX3}`,
  );

  // ── 6) MANDANTENTRENNUNG: bösartiger Body (orgId=A/planId=X/openLinkId=linkA)
  //      auf T_B → Session ist org B / plan Y, NICHT org A / plan X.
  const malicious = await postScreen(TB, {
    answers: { q1: "ja" },
    orgId: A,
    planId: X,
    openLinkId: ids.linkA,
    open_link_id: ids.linkA,
  });
  const tsB = malicious.body.sessionToken;
  if (tsB) sessionTokens.push(tsB);
  const sLinkB = await sessionsForLink(ids.linkB!);
  const bRows = sLinkB.data ?? [];
  const bIsolated =
    malicious.status === 200 &&
    malicious.body.qualified === true &&
    !!tsB &&
    tsB !== TB &&
    bRows.length === 1 &&
    bRows[0].org_id === B &&
    bRows[0].plan_id === Y &&
    bRows[0].open_link_id === ids.linkB &&
    bRows[0].invite_id === null;
  record(
    "tenant isolation: malicious body (orgId=A/planId=X) on T_B → session is org B / plan Y / linkB ONLY (body ignored)",
    bIsolated,
    `status=${malicious.status} org=${bRows[0]?.org_id === B ? "B" : bRows[0]?.org_id} plan=${bRows[0]?.plan_id === Y ? "Y" : bRows[0]?.plan_id} link=${bRows[0]?.open_link_id === ids.linkB ? "linkB" : "OTHER"}`,
  );

  // No org-A session was created by the T_B request (body could not name org A).
  const aSessionsTotal = await supabase
    .from("interview_sessions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", A);
  // Exactly the 2 qualified T_A sessions exist for org A — the malicious T_B
  // body added none.
  record(
    "tenant isolation: org A has exactly 2 sessions (the T_A walk-ins) — the malicious T_B body created NO org-A session",
    aSessionsTotal.count === 2,
    `orgA-sessions=${aSessionsTotal.count}`,
  );

  // ── 7) null-org-Invite-Pfad bleibt 404 (byte-identischer Guard, Regression).
  const nullOrg = await fetch(`${BASE}/api/interview/${tok.TNULL}/screen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers: {} }),
  });
  const nullOrgSessions = await supabase
    .from("interview_sessions")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", X)
    .is("invite_id", null) // belt-and-suspenders; the guard returns before create
    .is("open_link_id", null);
  record(
    "regression: null-org invite path POST /api/interview/[T_NULL]/screen → 404 (byte-identical guard, NO session)",
    nullOrg.status === 404 && (nullOrgSessions.count ?? 0) === 0,
    `status=${nullOrg.status} stray-sessions=${nullOrgSessions.count}`,
  );

  // ── 8) Unbekannter Token → 404 (fail-closed).
  const unknown = await postScreen(mintToken(), { answers: { q1: "ja" } });
  record(
    "unknown token → 404 (fail-closed)",
    unknown.status === 404,
    `status=${unknown.status}`,
  );

  // ── 9) GLOBAL INVARIANTE: KEIN interview_sessions.access_token gleicht je
  //      einem Open-Link-Token (der geteilte Token wird NIE Session-Token).
  const openTokens = [tok.TA!, tok.TA2!, tok.TA3!, tok.TB!];
  const collide = await supabase
    .from("interview_sessions")
    .select("id", { count: "exact", head: true })
    .in("access_token", openTokens);
  record(
    "GLOBAL: no interview_sessions.access_token equals ANY open-link token (open token never becomes a session token)",
    (collide.count ?? -1) === 0,
    `collisions=${collide.count}`,
  );
}

async function cleanup() {
  const linkIds = [ids.linkA, ids.linkA2, ids.linkA3, ids.linkB].filter(Boolean) as string[];
  const orgs = [ids.orgA, ids.orgB].filter(Boolean) as string[];
  const plans = [ids.planX, ids.planX2, ids.planX3, ids.planY].filter(Boolean) as string[];

  // Sessions first (FK to open_links via SET NULL, to plans via plan_id).
  if (linkIds.length) {
    await supabase.from("interview_sessions").delete().in("open_link_id", linkIds);
  }
  if (sessionTokens.length) {
    await supabase.from("interview_sessions").delete().in("access_token", sessionTokens);
  }
  if (orgs.length) {
    await supabase.from("research_screening_responses").delete().in("org_id", orgs);
  }
  if (tok.TNULL) {
    await supabase.from("research_invites").delete().eq("access_token", tok.TNULL);
  }
  if (linkIds.length) {
    await supabase.from("research_open_links").delete().in("id", linkIds);
  }
  if (plans.length) {
    await supabase.from("research_plans").delete().in("id", plans);
  }
  if (orgs.length) {
    await supabase.from("organizations").delete().in("id", orgs);
  }
}

async function verifyClean() {
  const orgs = await supabase
    .from("organizations")
    .select("id")
    .like("clerk_org_id", `${MARK}-%`);
  const leftOrgs = orgs.data?.length ?? 0;

  const linkIds = [ids.linkA, ids.linkA2, ids.linkA3, ids.linkB].filter(Boolean) as string[];
  const sess = linkIds.length
    ? await supabase
        .from("interview_sessions")
        .select("id", { count: "exact", head: true })
        .in("open_link_id", linkIds)
    : { count: 0 };
  const links = linkIds.length
    ? await supabase
        .from("research_open_links")
        .select("id", { count: "exact", head: true })
        .in("id", linkIds)
    : { count: 0 };
  const inv = tok.TNULL
    ? await supabase
        .from("research_invites")
        .select("id", { count: "exact", head: true })
        .eq("access_token", tok.TNULL)
    : { count: 0 };

  record(
    "cleanup: 0 residual (orgs / sessions / open_links / null-org invite all gone)",
    leftOrgs === 0 &&
      (sess.count ?? 0) === 0 &&
      (links.count ?? 0) === 0 &&
      (inv.count ?? 0) === 0,
    `orgs=${leftOrgs} sessions=${sess.count} links=${links.count} invite=${inv.count}`,
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

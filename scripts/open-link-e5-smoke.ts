import { config } from "dotenv";

// Env wie der E1/E2/E4-Smoke (.env.local zuerst, dann .env).
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { createResearchSupabase } from "@/lib/research/db";
import type { Json } from "@/types/database";
// NB: wie der E4-Smoke fährt dieser Test die ECHTE Route über HTTP gegen
// `next start` und prüft das Ergebnis direkt in der DB (service-role-Client).
// session-service / research-orchestration werden BEWUSST nicht importiert
// (server-only + react-server crashen unter tsx); die Cap-Durchsetzung + der
// Opus-Turn laufen IM Next-Runtime, nicht hier.

/**
 * Offener Studien-Link — Etappe-5-Smoke (Anti-Abuse v1: max_sessions-Cap),
 * ende-zu-ende gegen die ECHTE Route POST /api/interview/open/[token]/screen.
 *
 * HEADLINE (das Spend-Tor schließt sich):
 *   Ein Link mit max_sessions=N: N qualifizierte Walk-ins → N Sessions; der
 *   (N+1)-te QUALIFIZIERTE Versuch → „Studie voll" (403 {full:true}), KEINE
 *   (N+1)-te Session und — entscheidend — KEIN Opus-Turn. Der Cap-COUNT sitzt
 *   TEXTUELL VOR createResearchInterview (dem Opus-Eröffnungs-Turn), also kostet
 *   ein voller Link NULL KI-Spend.
 *
 *   Beweis, dass der (N+1)-te Versuch keinen Opus-Turn feuert (dreifach):
 *     (a) STRUKTUR: die Antwort 403 {available:false, full:true} wird AUSSCHLIESS-
 *         LICH im Cap-Branch erzeugt — der einzige return dieser Form — und der
 *         Cap-Branch steht VOR dem createResearchInterview-Aufruf. Diese Antwort-
 *         Form zu sehen heißt: createResearchInterview (und der Opening-Turn
 *         nextResearchMessage darin) wurde NIE aufgerufen.
 *     (b) DB: keine neue interview_sessions-Zeile für den Link (die Zeile entsteht
 *         nur INNERHALB createInterviewSession, direkt nach dem Opus-Turn).
 *     (c) LATENZ: die Cap-Absage kehrt in Sub-Opus-Zeit zurück (ein einzelner
 *         COUNT statt eines Modell-Calls) — als zusätzliche Evidenz protokolliert.
 *
 * WEITERE PRÜFUNGEN:
 *   • Abweisungen verbrauchen KEIN Kontingent (nur erzeugte Sessions tragen
 *     open_link_id): eine Abweisung vor dem Cap frisst nicht den einzigen Slot.
 *   • max_sessions=NULL → KEIN Cap (Kontroll-Fall): 2 qualifizierte Walk-ins auf
 *     einem null-Cap-Link kommen beide durch (null wird nicht als 0/Default-Cap
 *     behandelt).
 *   • E4-REGRESSION (auf der jetzt modifizierten Route, ohne e4:smoke neu zu
 *     fahren): frischer Token != Open-Token; bösartiger Body (orgId/planId/
 *     openLinkId/max_sessions) wird ignoriert (Zod strip, Felder aus der Link-
 *     Zeile); Mandantentrennung T_B → nur org-B-Session; harte Screening-Pflicht;
 *     null-org-Invite-Pfad weiter 404; KEIN Open-Token wird je Session-Token.
 *
 * Opus-Turns bewusst minimal (5 gesamt): L1 1× + L2 1× + L3 2× + T_B 1×. Alle
 * Cap-Absagen, Abweisungen, no-screening- und 404-Fälle feuern KEINEN Opus-Turn.
 *
 * Voraussetzung: Migration 20260629000000 angewendet; `next build` gelaufen;
 * `next start` läuft unter OPENLINK_E5_BASE_URL (Default http://localhost:4123);
 * SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL + ANTHROPIC_API_KEY in
 * .env.local. Alle Testdaten tragen den RUN-Marker und werden im finally restlos
 * gelöscht (+ verifyClean auf 0).
 */

const BASE = process.env.OPENLINK_E5_BASE_URL ?? "http://localhost:4123";
const RUN = Date.now();
const MARK = `smoke-openlink-e5-${RUN}`;

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
  planX1?: string; // org A, screened, cap=1 (cap enforcement)
  planX2?: string; // org A, screened, cap=1 (rejection doesn't consume)
  planX3?: string; // org A, screened, cap=NULL (no-cap control)
  planX4?: string; // org A, NO screening (screening-pflicht regression)
  planY?: string; // org B, screened, cap=1 (isolation regression)
  linkX1?: string;
  linkX2?: string;
  linkX3?: string;
  linkX4?: string;
  linkB?: string;
} = {};

const tok: {
  T1?: string;
  T2?: string;
  T3?: string;
  T4?: string;
  TB?: string;
  TNULL?: string;
} = {};

// Session tokens we mint — collected for the global "no session token equals any
// open-link token" assertion + cleanup.
const sessionTokens: string[] = [];

function mintToken(): string {
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
    void res.status; // any HTTP response proves the server is up
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
      objective: "E5 cap smoke",
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
  maxSessions: number | null,
): Promise<{ id: string; token: string }> {
  const token = mintToken();
  const r = await supabase
    .from("research_open_links")
    .insert({
      org_id: orgId,
      plan_id: planId,
      access_token: token,
      status: "active",
      max_sessions: maxSessions,
      valid_until: null,
    })
    .select("id")
    .single();
  if (r.error || !r.data) throw new Error(`open_link insert: ${r.error?.message}`);
  return { id: r.data.id, token };
}

async function setup() {
  ids.orgA = await insertOrg("A", "OpenLink E5 Smoke Org A");
  ids.orgB = await insertOrg("B", "OpenLink E5 Smoke Org B");

  ids.planX1 = await insertPlan(ids.orgA, "E5 Study X1 (cap=1)", true);
  ids.planX2 = await insertPlan(ids.orgA, "E5 Study X2 (rejection)", true);
  ids.planX3 = await insertPlan(ids.orgA, "E5 Study X3 (cap=null)", true);
  ids.planX4 = await insertPlan(ids.orgA, "E5 Study X4 (no screening)", false);
  ids.planY = await insertPlan(ids.orgB, "E5 Study Y (org B, cap=1)", true);

  const l1 = await insertLink(ids.orgA, ids.planX1, 1);
  ids.linkX1 = l1.id;
  tok.T1 = l1.token;
  const l2 = await insertLink(ids.orgA, ids.planX2, 1);
  ids.linkX2 = l2.id;
  tok.T2 = l2.token;
  const l3 = await insertLink(ids.orgA, ids.planX3, null);
  ids.linkX3 = l3.id;
  tok.T3 = l3.token;
  const l4 = await insertLink(ids.orgA, ids.planX4, 1);
  ids.linkX4 = l4.id;
  tok.T4 = l4.token;
  const lb = await insertLink(ids.orgB, ids.planY, 1);
  ids.linkB = lb.id;
  tok.TB = lb.token;

  // Null-org invite (org_id = NULL) — regression guard for the byte-identical
  // !invite.org_id guard on the SEPARATE per-invite path.
  tok.TNULL = mintToken();
  const inv = await supabase
    .from("research_invites")
    .insert({
      org_id: null,
      plan_id: ids.planX1,
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
  ms: number;
  body: {
    qualified?: boolean;
    sessionToken?: string;
    available?: boolean;
    full?: boolean;
    error?: string;
  };
};

async function postScreen(token: string, body: unknown): Promise<ScreenResponse> {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/interview/open/${token}/screen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = (await res.json().catch(() => ({}))) as ScreenResponse["body"];
  // Collect ANY returned session token centrally (regardless of status) so cleanup
  // stays HERMETIC even if the route ever leaked a token on a non-created path —
  // not just on the success branches the callers happen to check.
  if (parsed.sessionToken) sessionTokens.push(parsed.sessionToken);
  return { status: res.status, ms: Date.now() - t0, body: parsed };
}

async function sessionsForLink(linkId: string) {
  return supabase
    .from("interview_sessions")
    .select("id, org_id, plan_id, invite_id, open_link_id, access_token, screening_answers, kind")
    .eq("open_link_id", linkId);
}

async function countSessionsForLink(linkId: string): Promise<number> {
  const r = await sessionsForLink(linkId);
  return r.data?.length ?? -1;
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
  const X1 = ids.planX1!;
  const Y = ids.planY!;
  const T1 = tok.T1!;
  const TB = tok.TB!;

  // ── 1) CAP-ENFORCEMENT (L1, max=1): erste qualifizierte Session entsteht,
  //      die (N+1)-te qualifizierte → „Studie voll", KEINE Session, KEIN Opus.
  //      q1 trägt einen BÖSARTIGEN Body (orgId=B/planId=Y/openLinkId=linkB/
  //      max_sessions=999) → muss komplett ignoriert werden (Zod strip; Cap +
  //      org/plan aus der Link-Zeile).
  const q1 = await postScreen(T1, {
    answers: { q1: "ja" },
    orgId: B,
    planId: Y,
    openLinkId: ids.linkB,
    open_link_id: ids.linkB,
    max_sessions: 999,
  });

  const q2 = await postScreen(T1, { answers: { q1: "ja" } }); // (N+1)-te qualifiziert

  const sX1 = await sessionsForLink(ids.linkX1!);
  const rowsX1 = sX1.data ?? [];

  record(
    "cap=1: 1st qualified → 200 {sessionToken} fresh (!=T1); (N+1)th qualified → 403 {available:false, full:true}, NO sessionToken",
    q1.status === 200 &&
      q1.body.qualified === true &&
      !!q1.body.sessionToken &&
      q1.body.sessionToken !== T1 &&
      q2.status === 403 &&
      q2.body.available === false &&
      q2.body.full === true &&
      q2.body.sessionToken === undefined,
    `q1=${q1.status}/${q1.body.qualified} q2=${q2.status}/full=${q2.body.full}/tok=${q2.body.sessionToken ?? "none"}`,
  );

  record(
    "cap=1: exactly ONE session for linkX1 — the (N+1)th created NONE (no Opus turn fired: no createResearchInterview ⇒ no session row)",
    rowsX1.length === 1 &&
      rowsX1[0].org_id === A &&
      rowsX1[0].plan_id === X1 &&
      rowsX1[0].open_link_id === ids.linkX1 &&
      rowsX1[0].invite_id === null,
    `sessions=${rowsX1.length} org=${rowsX1[0]?.org_id === A ? "A" : rowsX1[0]?.org_id} plan=${rowsX1[0]?.plan_id === X1 ? "X1" : rowsX1[0]?.plan_id}`,
  );

  // The malicious body's max_sessions=999 did NOT raise the cap — the (N+1)th was
  // still capped at 1. And the session is stamped org A / plan X1 (NOT the body's
  // org B / plan Y / linkB). Both prove the body is ignored end-to-end.
  record(
    "cap is read from the LINK ROW, not the body: malicious max_sessions=999 ignored (still capped at 1); session stamped org A/plan X1 (not body's B/Y/linkB)",
    q2.status === 403 &&
      rowsX1.length === 1 &&
      rowsX1[0].open_link_id === ids.linkX1 &&
      rowsX1[0].org_id === A &&
      rowsX1[0].plan_id === X1,
    `cappedAt1=${q2.status === 403} stampedToLinkX1=${rowsX1[0]?.open_link_id === ids.linkX1}`,
  );

  // OBSERVATION (logged, NOT a pass/fail gate — wall-clock timing is non-
  // deterministic: load/scheduling/network variance could in principle invert it
  // and cause a false FAIL). The AUTHORITATIVE no-Opus proof is the structural
  // assertions above: the 403 {full:true} response shape is produced ONLY by the
  // pre-Opus cap branch, plus zero new session row + exactly one qualified quote.
  // The timing is corroborating evidence only.
  console.log(
    `   ⏱  no-Opus evidence (observation): capped (N+1)th=${q2.ms}ms vs qualified-with-Opus=${q1.ms}ms` +
      `  (ratio ${q1.ms > 0 ? (q2.ms / q1.ms).toFixed(2) : "n/a"})`,
  );

  const qQuoteX1 = await quoteCount(A, X1, "qualified");
  record(
    "cap=1: exactly ONE qualified-quote for (A,X1) — the capped (N+1)th wrote NO quote (denial is before create)",
    qQuoteX1 === 1,
    `qualifiedQuote=${qQuoteX1}`,
  );

  // ── 2) ABWEISUNGEN VERBRAUCHEN KEIN KONTINGENT (L2, max=1): zuerst eine
  //      Abweisung (keine Session), dann eine qualifizierte (Session=1), dann eine
  //      qualifizierte → voll. Die Abweisung hat den einen Slot NICHT gefressen.
  const r2rej = await postScreen(tok.T2!, { answers: { q1: "nein" } });
  const afterRej = await countSessionsForLink(ids.linkX2!);
  const r2q1 = await postScreen(tok.T2!, { answers: { q1: "ja" } }); // Opus
  const afterQ1 = await countSessionsForLink(ids.linkX2!);
  const r2q2 = await postScreen(tok.T2!, { answers: { q1: "ja" } }); // → voll
  const afterQ2 = await countSessionsForLink(ids.linkX2!);

  record(
    "rejections do NOT consume the cap: reject(no session) → qualify(session=1) → qualify(403 full, still 1). The earlier rejection did not eat the single slot.",
    r2rej.status === 200 &&
      r2rej.body.qualified === false &&
      afterRej === 0 &&
      r2q1.status === 200 &&
      r2q1.body.qualified === true &&
      afterQ1 === 1 &&
      r2q2.status === 403 &&
      r2q2.body.full === true &&
      afterQ2 === 1,
    `afterReject=${afterRej} afterQ1=${afterQ1} q2=${r2q2.status}/full=${r2q2.body.full} afterQ2=${afterQ2}`,
  );

  // ── 3) max_sessions=NULL → KEIN Cap (Kontroll-Fall, L3): 2 qualifizierte
  //      Walk-ins kommen beide durch (null wird NICHT als 0/Default-Cap behandelt).
  const n1 = await postScreen(tok.T3!, { answers: { q1: "ja" } }); // Opus
  const n2 = await postScreen(tok.T3!, { answers: { q1: "ja" } }); // Opus
  const nSessions = await countSessionsForLink(ids.linkX3!);
  const linkX3Row = await supabase
    .from("research_open_links")
    .select("max_sessions")
    .eq("id", ids.linkX3!)
    .maybeSingle();
  record(
    "max_sessions=NULL → NO cap (control): 2 qualified walk-ins BOTH succeed (200) → 2 distinct sessions; null is not treated as 0/default-cap",
    n1.status === 200 &&
      n1.body.qualified === true &&
      n2.status === 200 &&
      n2.body.qualified === true &&
      !!n1.body.sessionToken &&
      !!n2.body.sessionToken &&
      n1.body.sessionToken !== n2.body.sessionToken &&
      nSessions === 2 &&
      linkX3Row.data?.max_sessions === null,
    `n1=${n1.status} n2=${n2.status} sessions=${nSessions} rowMax=${linkX3Row.data?.max_sessions}`,
  );

  // ── 4) E4-REGRESSION: harte Screening-Pflicht (Plan ohne Screening → 403, keine
  //      Session). Mein Cap-Code sitzt NACH diesem Guard, also unverändert.
  const noScreen = await postScreen(tok.T4!, { answers: {} });
  const sX4 = await countSessionsForLink(ids.linkX4!);
  record(
    "regression: no-screening open link (T4) → 403 {available:false}, NO session (hard screening requirement intact; cap code sits after this guard)",
    noScreen.status === 403 &&
      noScreen.body.available === false &&
      noScreen.body.full === undefined && // distinct from the cap denial ({full:true})
      sX4 === 0,
    `status=${noScreen.status} avail=${noScreen.body.available} full=${noScreen.body.full} sessions=${sX4}`,
  );

  // ── 5) MANDANTENTRENNUNG (T_B, org B): bösartiger Body (orgId=A/planId=X1/
  //      openLinkId=linkX1) → Session ist org B / plan Y / linkB, NICHT org A.
  const malicious = await postScreen(TB, {
    answers: { q1: "ja" },
    orgId: A,
    planId: X1,
    openLinkId: ids.linkX1,
    open_link_id: ids.linkX1,
  });
  const sB = await sessionsForLink(ids.linkB!);
  const bRows = sB.data ?? [];
  record(
    "regression (tenant isolation): malicious body (orgId=A/planId=X1) on T_B → session is org B / plan Y / linkB ONLY (body ignored)",
    malicious.status === 200 &&
      malicious.body.qualified === true &&
      !!malicious.body.sessionToken &&
      malicious.body.sessionToken !== TB &&
      bRows.length === 1 &&
      bRows[0].org_id === B &&
      bRows[0].plan_id === Y &&
      bRows[0].open_link_id === ids.linkB &&
      bRows[0].invite_id === null,
    `status=${malicious.status} org=${bRows[0]?.org_id === B ? "B" : bRows[0]?.org_id} plan=${bRows[0]?.plan_id === Y ? "Y" : bRows[0]?.plan_id}`,
  );

  // org A got NO extra session from the T_B request. org A has exactly: 1 (X1) +
  // 1 (X2) + 2 (X3) = 4 sessions, all org A; the malicious T_B body added none.
  const aTotal = await supabase
    .from("interview_sessions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", A);
  record(
    "regression (tenant isolation): org A has exactly 4 sessions (1+1+2) — the malicious T_B body created NO org-A session",
    aTotal.count === 4,
    `orgA-sessions=${aTotal.count}`,
  );

  // ── 6) null-org-Invite-Pfad bleibt 404 (byte-identischer Guard, Regression).
  const nullOrg = await fetch(`${BASE}/api/interview/${tok.TNULL}/screen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers: {} }),
  });
  record(
    "regression: null-org invite path POST /api/interview/[T_NULL]/screen → 404 (byte-identical guard)",
    nullOrg.status === 404,
    `status=${nullOrg.status}`,
  );

  // ── 7) Unbekannter Token → 404 (fail-closed).
  const unknown = await postScreen(mintToken(), { answers: { q1: "ja" } });
  record("unknown token → 404 (fail-closed)", unknown.status === 404, `status=${unknown.status}`);

  // ── 8) GLOBAL: KEIN interview_sessions.access_token gleicht je einem Open-Link-
  //      Token (der geteilte Token wird NIE Session-Token).
  const openTokens = [tok.T1!, tok.T2!, tok.T3!, tok.T4!, tok.TB!];
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
  const linkIds = [
    ids.linkX1,
    ids.linkX2,
    ids.linkX3,
    ids.linkX4,
    ids.linkB,
  ].filter(Boolean) as string[];
  const orgs = [ids.orgA, ids.orgB].filter(Boolean) as string[];
  const plans = [
    ids.planX1,
    ids.planX2,
    ids.planX3,
    ids.planX4,
    ids.planY,
  ].filter(Boolean) as string[];

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

  const linkIds = [
    ids.linkX1,
    ids.linkX2,
    ids.linkX3,
    ids.linkX4,
    ids.linkB,
  ].filter(Boolean) as string[];
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

  // Quotes are deleted by org_id in cleanup(); verify none survive. Re-resolve the
  // org ids from the RUN marker (cleanup may have nulled the local ids) so the
  // check holds even if org deletion partially failed.
  const orgRows = await supabase
    .from("organizations")
    .select("id")
    .like("clerk_org_id", `${MARK}-%`);
  const orgIds = (orgRows.data ?? []).map((o) => o.id);
  const allOrgIds = [
    ...new Set([...orgIds, ids.orgA, ids.orgB].filter(Boolean) as string[]),
  ];
  const quotes = allOrgIds.length
    ? await supabase
        .from("research_screening_responses")
        .select("id", { count: "exact", head: true })
        .in("org_id", allOrgIds)
    : { count: 0 };

  record(
    "cleanup: 0 residual (orgs / sessions / open_links / null-org invite / screening-quotes all gone)",
    leftOrgs === 0 &&
      (sess.count ?? 0) === 0 &&
      (links.count ?? 0) === 0 &&
      (inv.count ?? 0) === 0 &&
      (quotes.count ?? 0) === 0,
    `orgs=${leftOrgs} sessions=${sess.count} links=${links.count} invite=${inv.count} quotes=${quotes.count}`,
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

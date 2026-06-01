import "server-only";

import { createResearchSupabase, type ResearchOpenLinkRow } from "./db";
import { getResearchPlan } from "./plans-service";
import type { NeedsScreeningView } from "@/lib/voice-agent/session-service";
import type { InterviewLanguage } from "@/lib/voice-agent/interviewer";

/**
 * Offener Studien-Link (Phase 4, Baustein 2) — Resolver-Kern (Etappe 1).
 *
 * EIN studienweiter, öffentlich teilbarer Link, über den beliebig viele ANONYME
 * Walk-ins an EINER Studie teilnehmen. Dieses Modul ist der PHYSISCH GETRENNTE
 * Eintritts-Pfad: ein Klon der Resolver-Logik des per-Invite-Pfads
 * (findInviteByAccessToken @ scheduling.ts:150, resolvePublicEntry @
 * session-service.ts:491), bewusst dupliziert statt geteilt. So wird
 * findInviteByAccessToken auf dem Open-Pfad NIE aufgerufen, findOpenLinkBy-
 * AccessToken auf dem Invite-Pfad nie, und der load-bearing !invite.org_id-Guard
 * (session-service.ts:403/:501, screen/route.ts:61) bleibt byte-identisch
 * unangetastet — es gibt keinen geteilten Branch, der je auf den gesperrten
 * null-org-Pfad zurückfallen könnte.
 *
 * ── MANDANTENTRENNUNG (das Herz) ─────────────────────────────────────────────
 * Ein Open-Link-Token für Studie X (org A) kann AUSSCHLIESSLICH Studie X von
 * org A erreichen; Studie Y einer anderen org B zu erreichen ist STRUKTURELL
 * unmöglich, nicht nur gefiltert:
 *
 *   1. Keine null-org-Zeile auf diesem Pfad. research_open_links.org_id ist
 *      NOT NULL (Schema-Constraint, 20260629000000). Der service-role-Client
 *      umgeht zwar RLS, aber es gibt keine null-org-Zeile zum Hineinfallen und
 *      die EINZIGE Query gegen die Tabelle ist der Single-Row-Token-Match.
 *   2. Token → genau eine ACTIVE Zeile. .eq("access_token", …) auf dem
 *      sparse-unique-Index, .eq("status","active") fail-closed; 256-bit
 *      unratbar; nie enumerieren; KEIN client-gelieferter org_id/plan_id
 *      irgendwo auf dem Pfad.
 *   3. org_id + plan_id stammen AUSSCHLIESSLICH aus der Token-Zeile (server-
 *      gebunden), nie aus dem Request — der Walk-in kontrolliert nur den
 *      URL-Token (+ in E4 die Screening-Antworten, die kein org/plan-Feld
 *      tragen).
 *   4. Zweite strukturelle Schranke, geerbt: getResearchPlan(org_id, plan_id)
 *      erzwingt .eq("org_id").eq("id"); die Signatur verlangt orgId, man kann
 *      den Filter nicht „vergessen". Selbst eine Denorm-Drift (org_id passt
 *      nicht zum echten Plan-Owner) macht den Pfad fail-closed → null.
 *
 * Nach Session-Erzeugung (E4) läuft der Walk-in auf dem BESTEHENDEN
 * /interview/[sessionToken]-Pfad (loadByToken, unverändert) — der Open-Link-
 * spezifische Code ist NUR der Eintritt.
 */

// ── Public record shape ──────────────────────────────────────────────────────
// Spiegelt ResearchInviteRecord (scheduling.ts): snake_case für die FK-Spalten,
// damit der Lese-Klon zum Vorbild passt. org_id/plan_id sind hier NON-NULL
// (Schema-Constraint) — anders als beim nullable Invite.
export interface ResearchOpenLinkRecord {
  id: string;
  /** NOT NULL by schema — die ganze Sicherheits-Aussage dieses Baus. */
  org_id: string;
  /** NOT NULL by schema — die EINE Studie. */
  plan_id: string;
  access_token: string;
  status: "active" | "disabled";
  /** NULL = open-ended; Anti-Abuse-Cap (E5), kein Isolations-Mechanismus. */
  max_sessions: number | null;
  /** NULL = kein Ablauf; additiv, Eintritts-Prüfung in späterer Etappe. */
  valid_until: string | null;
  label: string | null;
  created_at: string;
}

function toRecord(row: ResearchOpenLinkRow): ResearchOpenLinkRecord {
  return {
    id: row.id,
    org_id: row.org_id,
    plan_id: row.plan_id,
    access_token: row.access_token,
    status: row.status,
    max_sessions: row.max_sessions,
    valid_until: row.valid_until,
    label: row.label,
    created_at: row.created_at,
  };
}

/**
 * Token-only lookup of an ACTIVE open link — KLON von findInviteByAccessToken
 * (scheduling.ts:150), gleiche Sicherheits-Posture.
 *
 * Org-agnostisch by design: die öffentliche Seite kennt die org nicht, der
 * unratbare access_token IST das Capability-Credential. Wir gehen über den
 * service-role-Client (RLS-bypassing) und matchen NUR per access_token (+
 * status='active'); wir listen nie, enumerieren nie, vertrauen nie einem org_id
 * aus dem Request. Trifft den sparse-unique-Index research_open_links_access_
 * token_idx → primary-key-class read.
 *
 * status='active' ist fail-closed in der DB-Query: disabled / unbekannt → null.
 * (valid_until wird hier bewusst NOCH NICHT geprüft — additive Spalte, Prüfung
 * folgt mit der Verdrahtung; der E1-Resolver verlangt nur status='active'.)
 */
export async function findOpenLinkByAccessToken(
  token: string,
): Promise<ResearchOpenLinkRecord | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_open_links")
    .select("*")
    .eq("access_token", token)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return toRecord(data);
}

// ── Screening-aware entry resolution (SKELETON, Etappe 1) ─────────────────────

/**
 * Kein Screening konfiguriert → der Walk-in geht zum (E3-)Consent-/Start-Step;
 * E4 mintet die Session beim Bestätigen. Etappe 1 STOPPT hier (Skelett): es wird
 * NOCH KEINE Session erzeugt und KEIN Opus-Turn gefeuert. Trägt genau die
 * server-gebundenen Felder, die E4 für createResearchInterview({ orgId, planId,
 * inviteId: null, openLinkId: link.id, … }) braucht.
 */
export interface OpenLinkReady {
  orgId: string;
  planId: string;
  planTitle: string | null;
  language: InterviewLanguage;
}

export type PublicOpenEntry =
  | { mode: "needs_screening"; screening: NeedsScreeningView }
  | { mode: "ready"; ready: OpenLinkReady };

// Offene Links tragen (noch) keine eigene language-Spalte — der Walk-in-Chrome
// defaultet auf dieselbe Locale, auf die research_invites.language defaultet
// (DEFAULT 'de', 20260621000000). Eine per-Link-Sprache ist eine spätere,
// additive Option. Lokal definiert, damit dieses leichte Resolver-Modul nicht
// den schweren interviewer-Runtime (Anthropic-SDK) zur Laufzeit zieht.
const OPEN_LINK_DEFAULT_LANGUAGE: InterviewLanguage = "de";

/**
 * Screening-aware entry resolution für die (E3-)Teilnehmer-Page — KLON-Logik von
 * resolvePublicEntry (session-service.ts:491), für den Open-Link-Pfad.
 *
 * WICHTIG (cross-participant-Invariante, §5.1): hier wird der Open-Link-Token
 * NIE gegen interview_sessions gematcht (kein loadByToken). Ein Open-Link-Token
 * ist ein GETEILTES Credential und darf NIE zum Session-Token werden — sonst
 * kollidieren alle Walk-ins auf einer Session. Die Session-Erzeugung (E4) mintet
 * IMMER einen frischen Session-Token.
 *
 *   null              → unbekannt / disabled / Plan einer anderen org / Drift
 *                       (alles fail-closed, kein Enumerations-Signal)
 *   needs_screening   → Studie hat Screening-Fragen (keine Session, kein Opus-
 *                       Turn bis der Walk-in qualifiziert)
 *   ready             → kein Screening; bereit für Session-Create (E4)
 */
export async function resolvePublicOpenEntry(
  token: string,
): Promise<PublicOpenEntry | null> {
  // ① Token → genau eine ACTIVE Open-Link-Zeile. Fail-closed bei unbekannt/
  //    disabled. KEIN loadByToken auf diesem Token (cross-participant-Invariante).
  const link = await findOpenLinkByAccessToken(token);
  if (!link) return null;

  // ② Zweite strukturelle Schranke, unverändert geerbt: getResearchPlan filtert
  //    .eq("org_id", link.org_id).eq("id", link.plan_id). Die orgId ist der
  //    server-gebundene Wert aus der Token-Zeile, NIE aus dem Request. Ein Plan
  //    einer anderen org — oder jede Denorm-Drift zwischen link.org_id und dem
  //    echten Plan-Owner — löst zu null auf → fail-closed, kein Entry.
  const plan = await getResearchPlan(link.org_id, link.plan_id);
  if (!plan) return null;

  // ③ Screening konfiguriert? → needs_screening (keine Session, kein Opus-Turn,
  //    bis der Walk-in qualifiziert — spiegelt resolvePublicEntry). Reuse der
  //    bestehenden NeedsScreeningView, die der Invite-Pfad + ScreeningGate schon
  //    sprechen (E3 teilt die Komponente).
  const questions = plan.screeningQuestions ?? [];
  if (questions.length > 0) {
    return {
      mode: "needs_screening",
      screening: {
        orgId: link.org_id,
        planId: link.plan_id,
        planTitle: plan.title,
        language: OPEN_LINK_DEFAULT_LANGUAGE,
        questions,
      },
    };
  }

  // ④ Kein Screening → „ready". SKELETT (Etappe 1): wir stoppen hier und liefern
  //    die Daten, die E4 braucht, um die Session via createResearchInterview
  //    ({ openLinkId: link.id, … }) zu erzeugen. Es wird NOCH KEINE Session
  //    angelegt und KEIN Opus-Turn gefeuert.
  return {
    mode: "ready",
    ready: {
      orgId: link.org_id,
      planId: link.plan_id,
      planTitle: plan.title,
      language: OPEN_LINK_DEFAULT_LANGUAGE,
    },
  };
}

// ── Researcher-side management (Etappe 2) ─────────────────────────────────────
//
// Verwaltung des offenen Links DURCH den Researcher (Dashboard), strikt
// org-scoped. Spiegelt das plans-service-Muster (typed admin client, org_id ist
// IMMER ein FUNKTIONS-ARGUMENT aus der Clerk-Session der Route, NIE aus dem
// Request-Body; plan_id kommt aus der URL). Diese Funktionen sind ADDITIV — der
// öffentliche Eintritts-Pfad oben (findOpenLinkByAccessToken /
// resolvePublicOpenEntry / der null-org-Guard) bleibt byte-identisch unberührt.
//
// ── MANDANTENTRENNUNG (gleicher roter Faden) ─────────────────────────────────
// Die org_id der erzeugten Zeile ist STRUKTURELL an die org des Plans gebunden:
// createOpenLink verifiziert getResearchPlan(orgId, planId) (erzwingt
// .eq("org_id").eq("id")) BEVOR eine Zeile entsteht — ein Caller kann weder eine
// fremde org_id noch eine Denorm-Drift (org passt nicht zum Plan-Owner)
// einschleusen. Alle Mutationen sind .eq("org_id", orgId)-gescoped und lösen ihr
// Ziel server-seitig aus (orgId, planId) auf; der Client liefert NIE eine
// link_id. Der 256-bit access_token wird SERVER-SEITIG gemünzt
// (randomBytes(32).base64url, gleiche Mechanik wie research-orchestration.ts).
//
// ── Modell: ein Link-Row pro Studie, status in-place getoggelt ───────────────
// research_open_links_plan_active_idx (partial-unique über status='active')
// erzwingt höchstens EINEN aktiven Link je Studie. E2 hält genau einen Row pro
// Studie und togglet seinen status in-place (gleicher Token bleibt gültig):
// Erzeugen = erstmalige Münzung, Deaktivieren = Kill-Switch/Widerruf,
// Aktivieren = Re-Aktivieren. createOpenLink ist idempotent (existiert schon ein
// aktiver Link, wird er unverändert zurückgegeben — kein Crash am Partial-Unique,
// kein Token-Churn).

/** Konservativer Default-Cap bei Erzeugung (vom Researcher überschreibbar; null
 *  = unbegrenzt). Reines Volumen-/Kosten-Limit (E5 zählt
 *  interview_sessions.open_link_id), KEIN Isolations-Mechanismus. */
export const OPEN_LINK_DEFAULT_MAX_SESSIONS = 100;

export interface OpenLinkSettingsInput {
  /** undefined → Default (bei create) bzw. unverändert (bei update); null = unbegrenzt. */
  maxSessions?: number | null;
  /** ISO-Datum/-Timestamp; null = kein Ablauf. */
  validUntil?: string | null;
  /** Dashboard-Kosmetik; null = keine. */
  label?: string | null;
}

/**
 * Der EINE Link-Row dieser Studie (aktiv ODER widerrufen), org-scoped, oder
 * null. Newest-first + limit 1 — defensiv, falls je mehrere Rows existierten.
 * Powering die Researcher-Panel-Anzeige (active → teilbar, disabled → re-
 * aktivierbar).
 */
export async function getOpenLinkForPlan(
  orgId: string,
  planId: string,
): Promise<ResearchOpenLinkRecord | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_open_links")
    .select("*")
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return toRecord(data);
}

/** Privater Helper: der AKTIVE Link-Row dieser Studie (≤1 garantiert durch die
 *  partial-unique research_open_links_plan_active_idx), org-scoped, oder null. */
async function findActiveOpenLinkRow(
  orgId: string,
  planId: string,
): Promise<ResearchOpenLinkRecord | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_open_links")
    .select("*")
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return toRecord(data);
}

/**
 * Erstmalige Münzung eines aktiven offenen Links für die Studie. Idempotent:
 * existiert bereits ein AKTIVER Link, wird dieser unverändert zurückgegeben
 * (respektiert die partial-unique-Invariante, kein Crash, kein Token-Churn).
 *
 * org_id/plan_id werden NIE vom Caller akzeptiert: org_id ist das
 * Funktions-Argument (Clerk-Session der Route), plan_id die URL; beide werden
 * — Defense-in-Depth — gegen getResearchPlan(orgId, planId) verifiziert, bevor
 * eine Zeile entsteht. Gehört der Plan nicht zur org → Fehler, KEINE Zeile.
 */
export async function createOpenLink(
  orgId: string,
  planId: string,
  input: OpenLinkSettingsInput = {},
): Promise<ResearchOpenLinkRecord> {
  // Defense-in-Depth: die org_id der Zeile darf NUR die org des echten Plans
  // sein. getResearchPlan erzwingt .eq("org_id").eq("id") — eine Drift (org
  // passt nicht zum Plan-Owner) oder ein fremder Plan fängt hier ab, nicht erst
  // beim öffentlichen Eintritt. Der Insert nutzt orgId/planId aus den Argumenten.
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    throw new Error(`createOpenLink: plan ${planId} not found in org ${orgId}`);
  }

  // Idempotent: schon ein aktiver Link da? → zurückgeben, nicht neu münzen.
  const existingActive = await findActiveOpenLinkRow(orgId, planId);
  if (existingActive) return existingActive;

  // 256-bit URL-safe token, gleiche Form wie research-orchestration.ts:246.
  const { randomBytes } = await import("node:crypto");
  const accessToken = randomBytes(32).toString("base64url");

  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_open_links")
    .insert({
      org_id: orgId,
      plan_id: planId,
      access_token: accessToken,
      status: "active",
      max_sessions:
        input.maxSessions === undefined
          ? OPEN_LINK_DEFAULT_MAX_SESSIONS
          : input.maxSessions,
      valid_until: input.validUntil ?? null,
      label: input.label ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    // Nebenläufigkeit: zwei gleichzeitige create-Calls passieren beide den
    // findActiveOpenLinkRow-Check oben; der zweite Insert verletzt dann das
    // partial-unique research_open_links_plan_active_idx. Das ist KEIN echter
    // Fehler, sondern der idempotente Fall — der nebenläufige Gewinner hat den
    // aktiven Link bereits angelegt. Re-Query und zurückgeben (kein Token-Churn,
    // kein 500, höchstens ein aktiver Link bleibt die Invariante). Nur wenn
    // weiterhin kein aktiver Link existiert, ist es ein echter Insert-Fehler.
    const racedWinner = await findActiveOpenLinkRow(orgId, planId);
    if (racedWinner) return racedWinner;
    throw new Error(
      `createOpenLink: insert failed: ${error?.message ?? "no row returned"}`,
    );
  }
  return toRecord(data);
}

/**
 * Status-Toggle des offenen Links der Studie (Kill-Switch / Widerruf).
 *
 *   "disabled" → der aktive Link wird widerrufen (findOpenLinkByAccessToken ist
 *                fail-closed auf status='active' → der öffentliche Eintritt ist
 *                sofort tot, gleicher Token).
 *   "active"   → ein widerrufener Link wird reaktiviert (gleicher Token).
 *
 * Org+Plan-scoped: das Ziel wird server-seitig aus (orgId, planId) aufgelöst,
 * der Client liefert KEINE link_id. Bei "active" wird die partial-unique-
 * Invariante respektiert — existiert bereits ein anderer aktiver Link, schlägt
 * das UPDATE fehl → null (kein zweiter aktiver Link).
 */
export async function setOpenLinkStatus(
  orgId: string,
  planId: string,
  status: "active" | "disabled",
): Promise<ResearchOpenLinkRecord | null> {
  const target = await getOpenLinkForPlan(orgId, planId);
  if (!target) return null;
  if (target.status === status) return target; // no-op

  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_open_links")
    .update({ status })
    .eq("org_id", orgId)
    .eq("id", target.id)
    .select("*")
    .maybeSingle();
  if (error || !data) return null; // inkl. partial-unique-Verletzung beim Re-Enable
  return toRecord(data);
}

/**
 * Cap-/Ablauf-/Kosmetik-Felder des offenen Links der Studie setzen. Berührt
 * status/access_token NICHT. Org+Plan-scoped; nur explizit gesetzte Felder
 * werden geschrieben (sparse update — undefined lässt das Feld unberührt, null
 * setzt es bewusst auf „kein Wert").
 */
export async function updateOpenLinkSettings(
  orgId: string,
  planId: string,
  input: OpenLinkSettingsInput,
): Promise<ResearchOpenLinkRecord | null> {
  const target = await getOpenLinkForPlan(orgId, planId);
  if (!target) return null;

  const update: {
    max_sessions?: number | null;
    valid_until?: string | null;
    label?: string | null;
  } = {};
  if (input.maxSessions !== undefined) update.max_sessions = input.maxSessions;
  if (input.validUntil !== undefined) update.valid_until = input.validUntil;
  if (input.label !== undefined) update.label = input.label;
  if (Object.keys(update).length === 0) return target;

  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_open_links")
    .update(update)
    .eq("org_id", orgId)
    .eq("id", target.id)
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return toRecord(data);
}

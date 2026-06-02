/**
 * Panel-Anbieter — Inbound-Attribution + Completion-Handshake (Phase 4,
 * Baustein 3, Etappen E1 + E2).
 *
 * PURE, seiteneffekt-freie Helfer, geteilt vom Open-Link-Eintritts-Page (Server),
 * der Screen-Route (Server) UND den Teilnehmer-Komponenten (Client). BEWUSST
 * KEIN "server-only": Substitution + Validierung müssen auf beiden Seiten und im
 * Unit-Test laufen. KEINE DB, KEIN Netz.
 *
 * SCOPE (E1+E2, No-Code-Schleife): die externe Teilnehmer-ID aus der Eintritts-
 * URL lesen, für Attribution + Dedup persistieren und am Terminal-Outcome den
 * Browser zurück zur Return-URL des Anbieters leiten. KEIN Provider-REST-Client,
 * KEIN API-Key, KEINE Credentials — das ist E3, NICHT hier.
 *
 * Heute ist der EINZIGE Anbieter Prolific (?PROLIFIC_PID=…). Die Form ist
 * generisch gehalten (Provider-Key + Param-Namen), sodass ein zweiter Anbieter
 * eine additive Erweiterung ist, kein Umbau — aber JETZT nur Prolific.
 */

/** Der EINZIGE heute unterstützte Anbieter. */
export const PANEL_PROVIDER = "prolific" as const;
export type PanelProvider = typeof PANEL_PROVIDER;

/** Prolific-URL-Parameter (Docs: prolific_id_option=url_parameters). */
export const PROLIFIC_PID_PARAM = "PROLIFIC_PID";
export const PROLIFIC_STUDY_ID_PARAM = "STUDY_ID";
export const PROLIFIC_SESSION_ID_PARAM = "SESSION_ID";

/**
 * Inbound-Attribution, persistiert auf der Session (panel_context jsonb) — PLUS
 * ein Snapshot der Complete-Return-URL, damit der Completion-Redirect am Ende
 * SELBST-ENTHALTEN ist (kein zweiter Read des offenen Links nötig).
 */
export interface PanelContext {
  provider: PanelProvider;
  participant_id: string;
  study_id: string | null;
  session_id: string | null;
  /** Snapshot von research_open_links.panel_completion.complete_url bei Session-
   *  Erzeugung. null, wenn der Link keine Completion-Konfig trägt
   *  (Attribution-only — E1 ohne E2). */
  complete_url: string | null;
}

/** Pro-Link Completion-Return-URLs (research_open_links.panel_completion). */
export interface PanelCompletion {
  complete_url: string | null;
  screenout_url: string | null;
  quotafull_url: string | null;
}

/** Validierte Inbound-Params (bevor die Completion-Konfig des Links bekannt ist). */
export interface PanelInbound {
  provider: PanelProvider;
  participantId: string;
  studyId: string | null;
  sessionId: string | null;
}

/**
 * Eine Panel-ID (Prolific PID / STUDY_ID / SESSION_ID) ist ein OPAKES,
 * pseudonymes Token. Wir akzeptieren AUSSCHLIESSLICH [A-Za-z0-9_-], Länge 1..100
 * — streng genug, dass der Wert nie aus einem URL-Query ausbrechen oder Markup
 * injizieren kann, generisch genug für Prolifics 24-Hex-IDs und die Tokens
 * anderer Anbieter. Alles andere → abgelehnt (als „kein Panel-Eintritt"
 * behandelt), nie blind gespeichert.
 */
const PANEL_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

export function isValidPanelId(value: unknown): value is string {
  return typeof value === "string" && PANEL_ID_RE.test(value);
}

/** Erster String-Wert eines Keys aus einem Next-searchParams-Record. */
function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Parsen + Validieren der Panel-Attributions-Params aus einem Eintritts-URL-
 * searchParams-Record. Liefert null, wenn KEINE gültige Panel-ID da ist → der
 * Aufrufer behandelt den Eintritt als gewöhnlichen (Nicht-Panel-)Walk-in,
 * BYTE-IDENTISCH zu heute. Optionale STUDY_ID / SESSION_ID werden still
 * verworfen, wenn fehlerhaft (Attribution funktioniert allein über die PID).
 */
export function parsePanelParams(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): PanelInbound | null {
  if (!searchParams) return null;
  const pid = firstParam(searchParams[PROLIFIC_PID_PARAM]);
  if (!isValidPanelId(pid)) return null;
  const studyRaw = firstParam(searchParams[PROLIFIC_STUDY_ID_PARAM]);
  const sessionRaw = firstParam(searchParams[PROLIFIC_SESSION_ID_PARAM]);
  return {
    provider: PANEL_PROVIDER,
    participantId: pid,
    studyId: isValidPanelId(studyRaw) ? studyRaw : null,
    sessionId: isValidPanelId(sessionRaw) ? sessionRaw : null,
  };
}

/**
 * Re-Validieren eines über die Leitung (POST-Body) empfangenen Panel-Objekts.
 * Gleiche Regeln wie parsePanelParams, aber aus einem bereits gekeyten Objekt;
 * null bei jeder ungültigen PID. Server-seitig an der Persistenz-Trust-Boundary
 * genutzt — der Client kontrolliert den Body, also nie blind übernehmen.
 */
export function coercePanelInbound(value: unknown): PanelInbound | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!isValidPanelId(v.participantId)) return null;
  return {
    provider: PANEL_PROVIDER,
    participantId: v.participantId,
    studyId: isValidPanelId(v.studyId) ? v.studyId : null,
    sessionId: isValidPanelId(v.sessionId) ? v.sessionId : null,
  };
}

/** Platzhalter, der in einem Completion-Template durch die Teilnehmer-ID ersetzt wird. */
export const PANEL_PID_PLACEHOLDER = "{PID}";

/**
 * Baut die finale Anbieter-Return-URL für ein Terminal-Outcome aus einem
 * gespeicherten Template + der Teilnehmer-ID. Liefert null (→ KEIN Redirect,
 * Fallback auf den normalen Screen), wenn das Template leer ODER keine sichere
 * http(s)-URL ist.
 *
 * Substitution: jedes {PID} im Template wird durch die (bereits validierte)
 * Teilnehmer-ID ersetzt. Prolifics Complete-URL braucht keine PID (der
 * Completion-Code steckt drin) → ein Template ohne {PID} wird unverändert
 * genutzt. Ein Anbieter, der die ID zurückspiegelt (z. B. ?RID={PID}), bekommt
 * sie angehängt.
 *
 * SICHERHEIT: nur http:/https:-Schemata passieren. javascript:, data: etc.
 * werden abgelehnt, sodass ein fehlkonfiguriertes Template nie zum XSS-Sink an
 * der window.location-Zuweisung werden kann. Die Teilnehmer-ID ist auf
 * [A-Za-z0-9_-] vorvalidiert, der substituierte Wert ist also stets URL-sicher.
 */
export function buildPanelRedirectUrl(
  template: string | null | undefined,
  participantId: string,
): string | null {
  if (!template || typeof template !== "string") return null;
  if (!isValidPanelId(participantId)) return null;
  const substituted = template.split(PANEL_PID_PLACEHOLDER).join(participantId);
  let url: URL;
  try {
    url = new URL(substituted);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.toString();
}

/**
 * Narrow eines unbekannten jsonb-Werts (aus interview_sessions.panel_context) zu
 * PanelContext, defensiv. Eine gültige participant_id ist Pflicht — ohne sie ist
 * die Zeile keine Panel-Session und liefert null (→ kein Redirect, byte-identisch
 * zum Nicht-Panel-Fall). complete_url wird nur als sicherer http(s)-String
 * übernommen wäre Overkill hier — das prüft buildPanelRedirectUrl beim Bauen;
 * hier nur als String|null durchreichen.
 */
export function coercePanelContext(value: unknown): PanelContext | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!isValidPanelId(v.participant_id)) return null;
  const str = (x: unknown): string | null =>
    typeof x === "string" && x.length > 0 ? x : null;
  return {
    provider: PANEL_PROVIDER,
    participant_id: v.participant_id,
    study_id: isValidPanelId(v.study_id) ? v.study_id : null,
    session_id: isValidPanelId(v.session_id) ? v.session_id : null,
    complete_url: str(v.complete_url),
  };
}

/**
 * Narrow eines unbekannten jsonb-Werts (aus einer DB-Zeile) zu PanelCompletion,
 * defensiv. Leere Strings → null. Wenn KEIN Feld gesetzt ist → das ganze Objekt
 * null (= keine Completion-Konfig, Redirects sind no-ops).
 */
export function coercePanelCompletion(value: unknown): PanelCompletion | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const str = (x: unknown): string | null =>
    typeof x === "string" && x.length > 0 ? x : null;
  const completion: PanelCompletion = {
    complete_url: str(v.complete_url),
    screenout_url: str(v.screenout_url),
    quotafull_url: str(v.quotafull_url),
  };
  if (
    !completion.complete_url &&
    !completion.screenout_url &&
    !completion.quotafull_url
  ) {
    return null;
  }
  return completion;
}

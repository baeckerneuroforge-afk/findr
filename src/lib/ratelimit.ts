import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

/**
 * Plattformweites Rate-Limiting — dependency-frei gegen die Upstash-Redis-
 * REST-API (nur globalThis.fetch + AbortSignal.timeout; KEIN @upstash/*, KEIN
 * node:crypto → edge-safe). Eingehängt an EINER Stelle in src/proxy.ts über den
 * High-Level-Wrapper `enforceRateLimit(req)`.
 *
 * NICHT-VERHANDELBARE SEMANTIK (Sicherheit + Verfügbarkeit):
 *
 *  • INERT OHNE ENV — sind UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN nicht
 *    gesetzt, ist der Limiter VOLLSTÄNDIG inert: kein Netzwerk-Call, sofort
 *    `{ ok: true }`. Der Merge ändert das Laufzeitverhalten zu NULL, solange
 *    André keine Env setzt. (Vorbild: requireVoiceAgentAuth-Inertness.)
 *
 *  • FAIL-OPEN (Default) — kann der Store den Zähler nicht definitiv ermitteln
 *    (Timeout, non-2xx, Error-Shape, geworfene Exception), lässt der Limiter die
 *    Anfrage DURCH (Verfügbarkeit sticht best-effort-Schutz). Nur ein
 *    DEFINITIVER Über-Limit-Zähler führt zu 429. Jeder fail-open-Pfad loggt laut
 *    via console.error. (Vorbild: signals.ts-Fail-open-Posture.)
 *    AUSNAHME: die auth-Klasse darf per Schalter fail-closed werden (§ unten).
 *
 *  • KEY NICHT SPOOFBAR — der Key entsteht NUR aus (a) signiertem Session-JWT
 *    (req.auth, vom Client nicht fälschbar), (b) Capability-Token aus dem Pfad
 *    (serverseitig vergebene 256-bit-ID), oder (c) Plattform-gesetzter IP. Es
 *    gibt KEINEN Pfad, in dem ein frei wählbarer Request-Header den org-/user-
 *    Key bestimmt. → weder eigenes Limit umgehbar noch Last einer FREMDEN Org
 *    zuschreibbar (siehe deriveRateLimitKey).
 *
 *  • EXEMPTIONS — voice-Bridge, cron (CRON_SECRET), Webhooks (HMAC),
 *    health-Checks, OAuth-Callbacks und teilnehmer-kritische Token-Pfade sind
 *    entweder exempt ODER tragen eine sehr großzügige eigene Klasse, damit
 *    Crons/Webhooks/Interviews nie fälschlich gedrosselt werden (siehe
 *    classifyApiPath). Die exempt-Prüfung läuft VOR jedem Netzwerk-Call.
 */

// ── Klassen + Limits ─────────────────────────────────────────────────────────

export type RateClass =
  | "auth"
  | "participant"
  | "llm"
  | "mutation"
  | "voiceAgent";

/**
 * Limits an EINER Stelle, leicht justierbar. Window-Algorithmus = fixed window
 * (SET…EX…NX + INCR, siehe upstashIncr — Schlüssel wird atomar mit TTL geboren).
 * Sliding window bewusst NICHT: mehr Komplexität ohne Sicherheitsgewinn für
 * Plattform-Throttling.
 */
export const RATE_LIMITS: Record<
  RateClass,
  { limit: number; windowSec: number; prefix: string }
> = {
  // login/brute-force-sensitiv; heute UNBELEGT (classifyApiPath gibt "auth" nie
  // zurück — Login läuft über das exempte /api/auth/). Als Reserve + für die
  // fail-closed-Doku definiert.
  auth: { limit: 10, windowSec: 60, prefix: "rl:auth:" },
  // großzügig — laufende Interviews/Events nie abwürgen.
  participant: { limit: 120, windowSec: 60, prefix: "rl:part:" },
  // teure Modell-Loops (konsoul-agent, cross-study-agent, synthesis, personas,
  // alle Modell-Routen).
  llm: { limit: 30, windowSec: 60, prefix: "rl:llm:" },
  // schreibende Endpunkte, kein/leichter LLM.
  mutation: { limit: 60, windowSec: 60, prefix: "rl:mut:" },
  // sehr großzügig — Pro-Turn-Batches laufender Voice-Gespräche.
  voiceAgent: { limit: 600, windowSec: 60, prefix: "rl:voice:" },
};

// ── Auth-fail-closed-Schalter (bewusste Abwägung, NICHT still festgelegt) ─────

/**
 * Verfügbarkeits-Abwägung — Andrés Entscheidung:
 * Default fail-OPEN für ALLE Klassen, inkl. auth. Grund: "Upstash down = kein
 * Login mehr" wäre ein Totalausfall — Verfügbarkeit sticht best-effort-Schutz.
 * Diese Konstante schaltet NUR die auth-Klasse bewusst auf fail-closed (bei
 * Store-Fehler → 429 statt durchlassen). Bleibt false, bis André das aktiv
 * will. Optional zur Laufzeit via RATE_LIMIT_AUTH_FAIL_CLOSED=true umschaltbar
 * (Idiom wie org.ts); die Default-Konstante reicht heute.
 */
const AUTH_FAIL_CLOSED_DEFAULT = false as const;

function authFailClosed(): boolean {
  // Env spiegelt den Default nur, wenn explizit "true" — sonst gilt die
  // Konstante. Heute ungesetzt → false.
  const env = process.env.RATE_LIMIT_AUTH_FAIL_CLOSED;
  if (env && env.trim().toLowerCase() === "true") return true;
  return AUTH_FAIL_CLOSED_DEFAULT;
}

// ── Kernfunktion checkRateLimit ──────────────────────────────────────────────

export type RateResult = {
  ok: boolean;
  remaining?: number;
  retryAfter?: number;
};

/** Harte Latenz-Kappe für den Store-Roundtrip — AbortError → fail-open. */
const STORE_TIMEOUT_MS = 600;

/**
 * Ermittelt den Fenster-Zähler für (cls, key) und fällt das Urteil.
 *
 * Reihenfolge:
 *  1. INERT OHNE ENV → sofort { ok: true } (kein fetch).
 *  2. Zähler via Upstash-Pipeline (fixed window), in try/catch gekapselt.
 *  3. DEFINITIVES Urteil nur bei (a) HTTP 2xx, (b) JSON parsebar, (c) count ist
 *     eine Zahl: count > limit → 429, sonst durchlassen.
 *  4. FAIL-OPEN (Default) bei jedem anderen Fall: console.error + { ok: true }.
 *     AUSNAHME: cls === "auth" && authFailClosed() → { ok: false }.
 */
export async function checkRateLimit(
  cls: RateClass,
  key: string,
): Promise<RateResult> {
  const { limit, windowSec, prefix } = RATE_LIMITS[cls];

  // 1) INERT OHNE ENV — eines von beiden leer/whitespace → vollständig inert.
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || url.trim() === "" || !token || token.trim() === "") {
    return { ok: true };
  }

  try {
    // 2) Zähler ermitteln.
    const count = await upstashIncr(
      url.trim(),
      token.trim(),
      prefix + key,
      windowSec,
    );

    // 3) DEFINITIVES Urteil — nur eine echte Zahl gilt als belastbar.
    if (typeof count === "number" && Number.isFinite(count)) {
      if (count > limit) {
        return { ok: false, remaining: 0, retryAfter: windowSec };
      }
      return { ok: true, remaining: Math.max(0, limit - count) };
    }

    // Unerwartetes Shape (kein count) → fail-open.
    throw new Error("unexpected upstash response shape");
  } catch (err) {
    // 4) FAIL-OPEN (Default) — Timeout/non-2xx/Error-Shape/Exception.
    console.error("[ratelimit] store error, failing open", { cls, err });
    if (cls === "auth" && authFailClosed()) {
      // Einzige bewusste fail-closed-Ausnahme (per Schalter aktiviert).
      return { ok: false, retryAfter: windowSec };
    }
    return { ok: true };
  }
}

/**
 * Upstash-REST-Aufruf (fixed window, EIN Round-Trip).
 *
 *   POST `${url}/pipeline`
 *   Body [["SET", fullKey, "0", "EX", windowSec, "NX"], ["INCR", fullKey]]
 *
 * SET …"EX"…"NX" legt den Schlüssel beim ERSTEN Treffer des Fensters ATOMAR MIT
 * TTL an (Wert "0", läuft nach windowSec ab); existiert er bereits, ist SET ein
 * No-op (NX) und die laufende TTL bleibt unberührt. Das anschließende INCR zählt
 * hoch. Dadurch trägt der Schlüssel IMMER eine TTL — anders als bei INCR-zuerst +
 * EXPIRE-"NX", wo ein fehlgeschlagenes/gedropptes EXPIRE einen TTL-losen, ewig
 * wachsenden Zähler hinterlassen und so einen grundlosen 429 erzeugen konnte
 * (die TTL ist hier Teil des atomaren SET, kann also nicht separat verloren gehen).
 *
 * Body-Form (Array im Body) statt Pfad-Form → robust gegen Sonderzeichen im Key.
 * Antwort-Shape [{"result":"OK"|null}, {"result":<count>}] — der count steht im
 * ZWEITEN Element (INCR). Wirft bei Timeout/non-2xx/Error-Shape/fehlendem count →
 * der Aufrufer fängt → fail-open.
 */
async function upstashIncr(
  url: string,
  token: string,
  fullKey: string,
  windowSec: number,
): Promise<number> {
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["SET", fullKey, "0", "EX", String(windowSec), "NX"],
      ["INCR", fullKey],
    ]),
    signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`upstash http ${res.status}`);
  }

  const parsed: unknown = await res.json();
  // Erwartet [{"result": "OK"|null}, {"result": <count>}]. Der count (INCR) steht
  // im ZWEITEN Element. Ein Error-Objekt ({"error": "..."}), ein fehlendes
  // zweites Element oder jedes andere Shape fällt hier durch und wirft.
  if (
    Array.isArray(parsed) &&
    parsed.length >= 2 &&
    parsed[1] &&
    typeof parsed[1] === "object" &&
    typeof (parsed[1] as { result?: unknown }).result === "number"
  ) {
    return (parsed[1] as { result: number }).result;
  }
  throw new Error("unexpected upstash response shape");
}

// ── Klassifizierung classifyApiPath ──────────────────────────────────────────

/**
 * Reine, deterministische Funktion (kein I/O). Auswertung in fester Reihenfolge,
 * erster Treffer gewinnt — EXEMPT MUSS vor allem anderen stehen.
 *
 * Sieht NUR den Pfad, nicht die HTTP-Methode. Pfade, deren Klasse vom Verb
 * abhängt (z.B. /api/deals/[id]/interview: GET=mutation-artig, POST=llm),
 * werden rein nach Pfad der SCHÄRFEREN sinnvollen Klasse zugeordnet — hier llm,
 * weil das großzügige mutation-Limit (60) den teuren POST nicht schützt und das
 * llm-Limit (30) für die selteneren GETs unschädlich ist. Bewusste, dokumen-
 * tierte v1-Vereinfachung: KEINE Methoden-Verzweigung.
 */
export function classifyApiPath(pathname: string): RateClass | "exempt" {
  // ── Stufe 1 — EXEMPT ───────────────────────────────────────────────────────
  // NextAuth/OAuth-Callbacks + Login-Flow; Vercel-Cron (CRON_SECRET) darf nie
  // 429; Webhook-Provider-Retries (HMAC); OAuth-Rückläufer; health + csp-report.
  if (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/webhooks/") ||
    (pathname.startsWith("/api/integrations/") &&
      pathname.endsWith("/callback")) ||
    pathname === "/api/health" ||
    pathname === "/api/csp-report"
  ) {
    return "exempt";
  }

  // ── Stufe 2 — voiceAgent ───────────────────────────────────────────────────
  // Agent/Bridge-Pfade, sehr großzügig (nicht exempt, aber praktisch nie
  // limitierend).
  if (
    pathname === "/api/voice/transcript" ||
    pathname === "/api/voice/complete" ||
    pathname === "/api/voice/session-context" ||
    pathname === "/api/voice/ingest"
  ) {
    return "voiceAgent";
  }

  // ── Stufe 3 — participant ──────────────────────────────────────────────────
  // teilnehmer-kritisch, per-Token. Deckt /api/interview/[token]/** inkl.
  // POST/stream/speak/voice/visual-capture/screen/events/consent/withdraw und
  // /api/interview/open/[token]/**. /api/voice/token mintet den LiveKit-Token
  // (login-frei) und gehört teilnehmerseitig hierher.
  if (
    pathname.startsWith("/api/interview/") ||
    pathname === "/api/voice/token"
  ) {
    return "participant";
  }

  // ── Stufe 4 — llm ──────────────────────────────────────────────────────────
  // teure Modell-Loops (Login-Session). Match via End-Segment/Teilpfad.
  const LLM_SUFFIXES = [
    "/konsoul-agent",
    "/cross-study-agent",
    "/mission-control",
    "/agent",
    "/synthesis",
    "/personas",
    "/synthetic-test", // inkl. …/synthetic-test/[runId]/step (siehe unten)
    "/guide",
    "/chat",
    "/highlights",
    "/stimuli",
    "/stimulus",
    "/analyze",
    "/product-discovery",
  ];
  if (
    LLM_SUFFIXES.some((s) => pathname.endsWith(s)) ||
    // …/synthetic-test/[runId]/step — der teure Step-Lauf unter synthetic-test.
    /\/synthetic-test\/[^/]+\/step$/.test(pathname) ||
    pathname === "/api/solution/generate" ||
    pathname === "/api/loss/extract" ||
    // /api/deals/[id]/interview POST → llm (pfadbasiert, schärfere Klasse).
    pathname.endsWith("/interview") ||
    pathname === "/api/bridge/research-to-sales/scan" ||
    pathname === "/api/bridge/sales-handover/scan"
  ) {
    return "llm";
  }

  // ── Stufe 5 — mutation (FALLBACK) ──────────────────────────────────────────
  // Alle übrigen /api/** unter Session-Auth (schreibend + lesend; ein hohes
  // 60/min-Limit deckt beides).
  return "mutation";
}

// ── Key-Ableitung deriveRateLimitKey ─────────────────────────────────────────

/**
 * NICHT SPOOFBAR — Quelle pro Fall, exakt benannt.
 *
 * SICHERHEITS-INVARIANTE: Der Key entsteht NUR aus (a) signiertem Session-JWT
 * (req.auth), (b) Capability-Token aus dem PFAD, oder (c) Plattform-gesetzter
 * IP. Es gibt KEINEN Pfad, in dem ein frei wählbarer Request-Header den
 * org-/user-Key bestimmt. Damit: weder eigenes Limit umgehbar noch Last einer
 * fremden Org zuschreibbar.
 */
export function deriveRateLimitKey(
  req: NextAuthRequest,
  pathname: string,
  cls: RateClass,
): string {
  // 1) Eingeloggt — Quelle ist das signierte JWT-Cookie, vom Client nicht
  //    fälschbar; kein Body-/Header-Wert fließt ein → kein Cross-Org-Spoofing.
  const user = req.auth?.user;
  if (user) {
    // bevorzugt die Org (Zitadel resource-owner aus token.orgId)…
    if (user.orgId && user.orgId.trim() !== "") {
      return `org:${user.orgId}`;
    }
    // …Fallback auf die User-id (token.sub, immer gesetzt bei Session).
    if (user.id && user.id.trim() !== "") {
      return `user:${user.id}`;
    }
  }

  // 2) participant — Token aus dem PFAD (serverseitig vergebene 256-bit-
  //    Capability-ID, kein frei wählbarer Header). Ein geratener Fremd-Token
  //    drosselt nur dessen eigenen Bucket, nie eine Org.
  if (cls === "participant") {
    const token = extractInterviewToken(pathname);
    if (token) {
      return `part:${token}`;
    }
    // /api/voice/token (participant ohne Pfad-Token): der LiveKit-Token steht
    // im Body, der in der Middleware NICHT konsumiert werden soll → IP genügt
    // für diese login-freie Mint-Route. Fällt unten auf den IP-Fallback.
  }

  // 3) voiceAgent — IP-Fallback. Der Agent authentifiziert sich per
  //    VOICE_AGENT_SHARED_SECRET/org-Token im Header; das Secret wird in der
  //    Middleware NICHT verifiziert (das tun die Route-Handler), und das
  //    großzügige 600/min-Limit macht den Key-Wert unkritisch. BEWUSST KEINE
  //    Header-Auswertung als Org-Zuordnung (sonst spoofbar).

  // 4) Fallback (anonym/kein Session-Key) — IP.
  //    VERTRAUENSGRENZE: Auf Vercel setzt die Plattform x-forwarded-for und
  //    überschreibt eingehende Client-Werte → der erste Hop ist vertrauens-
  //    würdig. Ein naiv geglaubter Client-x-forwarded-for AUSSERHALB Vercels
  //    wäre spoofbar — deshalb sind IP-Keys nur "best effort", tragen
  //    ausschließlich großzügige Klassen und NIEMALS fail-closed.
  const xff = req.headers.get("x-forwarded-for");
  const ip =
    (xff && xff.split(",")[0]?.trim()) ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return `ip:${ip}`;
}

/**
 * Extrahiert den Interview-Capability-Token aus dem Pfad — das Segment direkt
 * nach /api/interview/ bzw. /api/interview/open/. Nur der Token, keine
 * Unterpfade.
 */
function extractInterviewToken(pathname: string): string | null {
  const openPrefix = "/api/interview/open/";
  const prefix = "/api/interview/";
  if (pathname.startsWith(openPrefix)) {
    const rest = pathname.slice(openPrefix.length);
    const seg = rest.split("/")[0];
    return seg && seg !== "" ? seg : null;
  }
  if (pathname.startsWith(prefix)) {
    const rest = pathname.slice(prefix.length);
    const seg = rest.split("/")[0];
    // "open" ist kein Token (wäre vom openPrefix-Zweig oben gefangen worden,
    // außer es ist exakt /api/interview/open ohne nachfolgendes Segment).
    return seg && seg !== "" && seg !== "open" ? seg : null;
  }
  return null;
}

// ── 429-Response ─────────────────────────────────────────────────────────────

/**
 * Fertige 429-Response (die EINZIGE Response-Konstruktion — proxy.ts baut
 * keine). Retry-After konservativ = volles Fenster.
 */
function rateLimitedResponse(
  retryAfter: number | undefined,
  limit: number,
): Response {
  return NextResponse.json(
    { error: "rate_limited" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter ?? 60),
        "RateLimit-Limit": String(limit),
        "RateLimit-Remaining": "0",
      },
    },
  );
}

// ── High-Level-Wrapper für proxy.ts (der EINZIGE Berührungspunkt) ────────────

/**
 * Orchestriert exempt-Check → Klassifizierung → Key-Ableitung → checkRateLimit
 * → 429-Response. Gibt eine fertige Response zurück (= drosseln) oder null
 * (= durchlassen). proxy.ts ruft NUR diese Funktion.
 *
 * Die exempt-Klassifizierung läuft VOR dem Netzwerk-Call → exempt-Pfade
 * berühren Upstash nie.
 */
export async function enforceRateLimit(
  req: NextAuthRequest,
): Promise<Response | null> {
  // STRUKTURELL GARANTIERT FAIL-OPEN: der GESAMTE Pfad (Klassifizierung,
  // Key-Ableitung, Store-Call, Response-Bau) ist gekapselt. checkRateLimit fängt
  // Store-Fehler bereits selbst; diese äußere Klammer fängt JEDEN sonstigen Wurf
  // (z.B. aus deriveRateLimitKey oder dem Response-Bau), damit der Limiter NIE
  // eine Exception in die NextAuth-Middleware hochschlägt und so die Plattform
  // lahmlegt. Ein Wurf hier → durchlassen (return null), nie 500.
  try {
    const pathname = req.nextUrl.pathname;

    // Sicherheitsnetz — der Limiter greift NUR für /api/** (proxy.ts gated
    // zusätzlich). Seiten berühren ihn nie.
    if (!pathname.startsWith("/api/")) {
      return null;
    }

    const cls = classifyApiPath(pathname);
    if (cls === "exempt") {
      return null;
    }

    const key = deriveRateLimitKey(req, pathname, cls);
    const result = await checkRateLimit(cls, key);

    if (result.ok) {
      return null;
    }
    return rateLimitedResponse(result.retryAfter, RATE_LIMITS[cls].limit);
  } catch (err) {
    console.error("[ratelimit] enforce threw, failing open", err);
    return null;
  }
}

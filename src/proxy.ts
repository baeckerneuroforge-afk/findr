import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { enforceRateLimit } from "@/lib/ratelimit";

/**
 * Defense-in-Depth: erzwinge Login für die eingeloggte App-Oberfläche bereits
 * an der Middleware-Kante (Next.js 16: diese Datei heißt proxy.ts, nicht
 * middleware.ts). Heute prüft JEDE Dashboard-/Onboarding-Page ihren Login
 * selbst; dieser Proxy ist das Sicherheitsnetz, falls eine KÜNFTIGE Page diesen
 * Check vergisst — sie wäre sonst aus Versehen öffentlich.
 *
 * ALLOWLIST DER GESCHÜTZTEN PFADE — bewusst NUR die Seiten-Oberflächen
 * /dashboard und /onboarding. Alles andere bleibt unangetastet öffentlich:
 *   • Teilnehmer-Token-Seiten (/interview/**, /shared/synthesis/**),
 *   • ALLE /api/** (sie authentifizieren sich selbst: requireOrgIdOrError,
 *     Token, Voice-Agent-Secret, Webhook-HMAC, CRON_SECRET — eine pauschale
 *     /api-Sperre hier würde Teilnehmer/Webhooks/Crons brechen),
 *   • Marketing, /sign-in, /sign-up, OAuth-Callbacks (/api/auth/**),
 *     /api/csp-report.
 *
 * NextAuth v5: der exportierte `auth`-Wrapper hängt auf allen gematchten Pfaden
 * die Session an (req.auth) — nur die ERZWINGUNG ist auf die Allowlist gated.
 * Das ersetzt 1:1 das alte clerkMiddleware()+auth.protect() (Redirect bei
 * fehlender Session), der Matcher bleibt funktional gleich.
 */
export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Plattformweites Rate-Limiting — NUR für /api/**. Die gesamte Logik
  // (Klassifizierung, nicht-spoofbare Key-Ableitung, Upstash-Call, 429-Bau)
  // lebt in src/lib/ratelimit.ts; hier wird ausschließlich der High-Level-
  // Wrapper aufgerufen. enforceRateLimit gibt eine fertige 429-Response zurück
  // (= drosseln) oder null (= durchlassen). Ohne UPSTASH_*-Env ist der Limiter
  // vollständig inert (immer null) → null Verhaltensänderung. exempt-Pfade
  // (cron/webhook/voice-bridge/health/csp/OAuth) überspringen den Upstash-Call
  // KOMPLETT (Klassifizierung vor dem Netzwerk-Call). Doppelt gegated: hier per
  // Präfix + ein Sicherheitsnetz in enforceRateLimit selbst.
  if (pathname.startsWith("/api/")) {
    const limited = await enforceRateLimit(req);
    if (limited) return limited; // 429 — sonst implizit weiter
  }

  // Spiegelt das alte createRouteMatcher(["/dashboard(.*)", "/onboarding(.*)"]):
  // der nackte Pfad UND jeder Unterpfad.
  const isProtected = /^\/(?:dashboard|onboarding)(?:\/.*)?$/.test(pathname);

  if (isProtected && !req.auth) {
    // Wie Clerks auth.protect(): unauthentifiziert → zur Anmeldung umleiten und
    // das ursprüngliche Ziel als callbackUrl mitführen (Post-Login-Rücksprung).
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Alle übrigen Pfade laufen normal weiter (auth() hat nur die Session
  // angehängt, keine Erzwingung).
});

export const config = {
  // Perf: Der Matcher deckt nur noch die Pfade, auf denen dieser Proxy
  // tatsächlich etwas TUT — Login-Erzwingung (/dashboard, /onboarding) und
  // API-Rate-Limiting (/api). Vorher lief er (inkl. Session-JWT-Decode) auf
  // JEDEM Marketing-, Interview- und Shared-Request, ohne dort je etwas zu
  // entscheiden: Marketing ist öffentlich-statisch, /interview + /shared/**
  // authentifizieren sich selbst per Token, /sign-in|/sign-up sind öffentlich.
  // Session-Rotation (rotateZitadelToken im jwt-Callback) läuft weiterhin bei
  // jeder Dashboard-Navigation und jedem serverseitigen auth()-Read — dafür
  // braucht es keinen Middleware-Lauf auf öffentlichen Seiten. (trpc gab es
  // nie — Alt-Matcher-Relikt.)
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    // Always run for API routes (Rate-Limiting; die exempt-Klassifizierung
    // cron/webhook/voice/health/csp/OAuth liegt in enforceRateLimit selbst).
    "/api/:path*",
  ],
};

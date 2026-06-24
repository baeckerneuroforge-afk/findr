import { NextResponse } from "next/server";
import { auth } from "@/auth";

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
export default auth((req) => {
  const { pathname } = req.nextUrl;

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
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

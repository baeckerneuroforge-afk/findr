import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Defense-in-Depth: erzwinge Login für die eingeloggte App-Oberfläche bereits
 * an der Middleware-Kante. Heute prüft JEDE Dashboard-/Onboarding-Page ihren
 * Login selbst (requireOrgId → Redirect); diese Middleware ist das Sicherheits-
 * netz, falls eine KÜNFTIGE Page diesen Check vergisst (der Audit nannte u. a.
 * settings/{page,organization,profile,billing} ohne eigenen Server-Check) — sie
 * wäre sonst aus Versehen öffentlich.
 *
 * ALLOWLIST DER GESCHÜTZTEN PFADE — bewusst NUR die Seiten-Oberflächen
 * /dashboard und /onboarding. Alles andere bleibt unangetastet öffentlich:
 *   • Teilnehmer-Token-Seiten (/interview/**, /shared/synthesis/**),
 *   • ALLE /api/** (sie authentifizieren sich selbst: requireOrgIdOrError,
 *     Token, Voice-Agent-Secret, Webhook-HMAC, CRON_SECRET — eine pauschale
 *     /api-Sperre hier würde Teilnehmer/Webhooks/Crons brechen),
 *   • Marketing, /sign-in, /sign-up, OAuth-Callbacks, /api/csp-report.
 *
 * Geschützt wird also nur, was sicher geschützt sein DARF — neue Dashboard-Pages
 * sind automatisch abgedeckt, ohne dass ein zu breiter Matcher je einen
 * öffentlichen Pfad aussperren kann. clerkMiddleware() läuft weiterhin auf allen
 * Pfaden (Auth-Kontext für die self-auth-Routen), nur die ERZWINGUNG ist gated.
 */
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/onboarding(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

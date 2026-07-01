import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Turbopack riet den Workspace-Root falsch (~/pnpm-lock.yaml im Home) und
  // watchte/resolvte damit weit über das Repo hinaus — Dev-Server-Warnung
  // "inferred your workspace root". Expliziter Root = dieses Repo.
  turbopack: {
    root: path.join(__dirname),
  },
  // pdfkit ships .afm font-metric files that must be read from node_modules at
  // runtime. Keeping it external prevents the bundler from breaking those reads
  // on Vercel serverless.
  serverExternalPackages: ["pdfkit"],
  // The solution-report PDF (src/lib/pdf/solution-report.ts) reads the embedded
  // Geist .ttf files from src/lib/pdf/fonts at runtime via process.cwd(). Next's
  // file tracer can't see these dynamic fs reads, so include them explicitly in
  // the PDF route's serverless bundle — otherwise the PDF silently falls back to
  // Helvetica on Vercel. (The in-code Helvetica fallback stays as the safety net
  // if the files are ever missing.) The [dealId] segment is escaped so picomatch
  // treats the brackets literally instead of as a character class.
  outputFileTracingIncludes: {
    "/api/solution/\\[dealId\\]/pdf": ["./src/lib/pdf/fonts/*.ttf"],
    "/api/deals/\\[id\\]/interview/pdf": ["./src/lib/pdf/fonts/*.ttf"],
  },
  experimental: {
    // Perf-Etappe C (Multi-Root-Layouts): mit zwei Root-Layouts gibt es kein
    // gemeinsames Layout mehr, in dem ein klassisches Root-not-found rendern
    // könnte. global-not-found.tsx (app-Root) übernimmt 404s für URLs, die
    // GAR KEINE Route treffen — dokumentiertes Pattern dieser Next-Version
    // für genau diesen Fall (not-found.md §global-not-found).
    globalNotFound: true,
  },
  // The public marketing site is the (site) route group (German, flat/
  // unprefixed — canonical, unchanged since the Lovable relaunch) plus a real
  // English tree at src/app/en/** (asymmetric prefixing: German stays
  // unprefixed, only English sits under /en — see src/i18n/marketing-locale.ts
  // for the reasoning). These 301s forward OLD locale-prefixed marketing URLs
  // — and the legacy locale-less aliases — onto the matching new flat route so
  // existing links, bookmarks and crawler equity survive the cutover. Sources
  // match ONLY the `de` locale prefix now (not `de|en`): a matching `en`
  // pattern would 301 every real English page in src/app/en/** to the German
  // homepage before Next's router ever resolved it, since redirects run before
  // the filesystem router. /api, /dashboard, /sign-in, /sign-up, /interview,
  // /onboarding, /shared never start with de and are untouched either way.
  async redirects() {
    return [
      // ── old DE locale root → new homepage ──
      { source: "/:locale(de)", destination: "/", statusCode: 301 },

      // ── content pages that keep an equivalent flat route ──
      { source: "/:locale(de)/produkt", destination: "/plattform", statusCode: 301 },
      { source: "/:locale(de)/plattform", destination: "/plattform", statusCode: 301 },
      { source: "/:locale(de)/konsoul", destination: "/konsoul", statusCode: 301 },
      { source: "/:locale(de)/preise", destination: "/preise", statusCode: 301 },
      { source: "/:locale(de)/personas", destination: "/personas", statusCode: 301 },
      { source: "/:locale(de)/kontakt", destination: "/kontakt", statusCode: 301 },
      { source: "/:locale(de)/demo", destination: "/kontakt", statusCode: 301 },
      { source: "/:locale(de)/mensch-und-ki", destination: "/", statusCode: 301 },

      // ── legal ──
      { source: "/:locale(de)/impressum", destination: "/impressum", statusCode: 301 },
      { source: "/:locale(de)/datenschutz", destination: "/datenschutz", statusCode: 301 },
      { source: "/:locale(de)/agb", destination: "/agb", statusCode: 301 },
      { source: "/:locale(de)/cookies", destination: "/cookies", statusCode: 301 },

      // ── Lösungen (specific before the overview) ──
      { source: "/:locale(de)/loesungen/personas", destination: "/personas", statusCode: 301 },
      { source: "/:locale(de)/loesungen/ux-research", destination: "/loesungen/user-research", statusCode: 301 },
      { source: "/:locale(de)/loesungen/user-research", destination: "/loesungen/user-research", statusCode: 301 },
      { source: "/:locale(de)/loesungen/marktforschung", destination: "/loesungen", statusCode: 301 },
      { source: "/:locale(de)/loesungen", destination: "/loesungen", statusCode: 301 },

      // ── Methoden (old subpages now live under /loesungen) ──
      { source: "/:locale(de)/methoden/konzept-test", destination: "/loesungen/konzept-test", statusCode: 301 },
      { source: "/:locale(de)/methoden/creative-test", destination: "/loesungen/konzept-test", statusCode: 301 },
      { source: "/:locale(de)/methoden/markenwahrnehmung", destination: "/loesungen/markenwahrnehmung", statusCode: 301 },
      { source: "/:locale(de)/methoden/bedarf-verhalten", destination: "/loesungen/bedarf-verhalten", statusCode: 301 },
      { source: "/:locale(de)/methoden", destination: "/methoden", statusCode: 301 },

      // ── Branchen (now a single page) + Insights (no new equivalent → home) ──
      { source: "/:locale(de)/branchen/:slug*", destination: "/branchen", statusCode: 301 },
      { source: "/:locale(de)/insights/:path*", destination: "/", statusCode: 301 },

      // ── legacy locale-less aliases that have no flat route of their own ──
      { source: "/produkt", destination: "/plattform", statusCode: 301 },
      { source: "/pricing", destination: "/preise", statusCode: 301 },
      { source: "/demo", destination: "/kontakt", statusCode: 301 },
      { source: "/mensch-und-ki", destination: "/", statusCode: 301 },
      { source: "/insights/:path*", destination: "/", statusCode: 301 },

      // ── catch-all: any remaining old /de URL → homepage (never 404) ──
      // Deliberately /:locale(de) and NOT (de|en) — see the comment above.
      { source: "/:locale(de)/:path*", destination: "/", statusCode: 301 },

      // TODO D1: www → apex canonical redirect. The production domain isn't
      // final yet (placeholder findr.de), so this is PREPARED but inactive — a
      // guessed host would be wrong. Uncomment and confirm the host once the
      // real domain lands (verified `has: type:host` shape, Next 16 redirects):
      // {
      //   source: "/:path*",
      //   has: [{ type: "host", value: "www.findr.de" }],
      //   destination: "https://findr.de/:path*",
      //   permanent: true,
      // },
      // http → https needs no rule: the platform (Vercel) upgrades it and HSTS
      // (below) enforces it on every subsequent visit.
    ];
  },
  // Security headers (Etappe D hardening — plan §6/§8). Applied site-wide via
  // the `/:path*` matcher (verified present at runtime on `/`, `/dashboard` and
  // `/sitemap.xml`).
  //
  // SCOPE DECISION (D5): only headers that CANNOT break the authenticated app
  // are set here. A full content-CSP (`default-src`/`script-src`/`style-src`/
  // `connect-src`/…) is deliberately NOT set — it would have to allowlist
  // Clerk's frontend API + workers + telemetry and any third-party origin, and
  // getting that wrong silently breaks auth, the dashboard and the interview
  // surface in production. That needs a verified allowlist + a Content-Security-
  // Policy-Report-Only rollout first (it cannot be runtime-verified here). What
  // IS safe to set globally:
  //   • HSTS / X-Content-Type-Options / Referrer-Policy — never break anything.
  //   • CSP `frame-ancestors 'none'` — a single-directive CSP imposes NO
  //     script/style/connect/img restriction (CSP is per-directive: directives
  //     left unspecified are unrestricted), so it can't break Clerk, next-intl
  //     or inline styles. It only blocks clickjacking — the modern replacement
  //     for the legacy `X-Frame-Options` (§6/§8).
  //     ⚠ If the /interview open-link is ever meant to be iframe-EMBEDDED by a
  //     white-label customer, this would block that embed → scope it to exclude
  //     /interview (confirm with André). The interview is link-accessed today,
  //     so 'none' is safe.
  //   • Permissions-Policy with (self) allowlists — same-origin getUserMedia
  //     (voice interview) and getDisplayMedia (visual capture) keep working;
  //     only cross-origin iframes lose access to camera/mic/screen, which
  //     nothing embeds today (frame-ancestors 'none' anyway).
  //   • Content-Security-Policy-Report-Only — the rollout step the block above
  //     calls for: enforces NOTHING, only reports would-be violations to
  //     /api/csp-report (visible in Vercel logs). Once the report stream is
  //     quiet in production, the policy can be promoted to an enforcing
  //     Content-Security-Policy. NEVER promote without a quiet report stream.
  async headers() {
    // Zitadel-Realität (Hygiene-Audit 2026-07-01): die frühere Policy
    // allowlistete noch Clerk-Hosts (*.clerk.accounts.dev, Turnstile) — Clerk
    // ist vollständig entfernt, der Report-Stream hätte gegen eine veraltete
    // Welt gemessen und die Policy wäre so nie promotebar gewesen. Zitadel
    // braucht KEINE Allowlist: Login ist ein Full-Page-OIDC-Redirect
    // (next-auth server-side), es lädt kein Zitadel-JS und macht kein XHR von
    // unserem Origin aus.
    const cspReportOnly = [
      "default-src 'self'",
      // 'unsafe-inline' is required by Next's inline bootstrap scripts (no
      // nonce infrastructure yet).
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // https: in img-src is deliberate: stimulus images may live on external
      // hosts chosen by researchers.
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.livekit.cloud https://*.livekit.cloud",
      // blob: for TTS-MP3 playback and recorded-audio previews.
      "media-src 'self' blob: https:",
      "worker-src 'self' blob:",
      // Nichts wird mehr geframet (Turnstile war Clerks Bot-Schutz).
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "report-uri /api/csp-report",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()",
          },
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
        ],
      },
    ];
  },
};

// next-intl: point the plugin at the request config (i18n without routing).
// Wraps the config above WITHOUT replacing it — serverExternalPackages and
// outputFileTracingIncludes are preserved.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);

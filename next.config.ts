import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
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
  // /pricing was the old EN static-HTML pricing route; Etappe C replaces it with
  // the German /preise. Keep old links alive with a permanent (308) redirect.
  async redirects() {
    return [
      { source: "/pricing", destination: "/preise", permanent: true },
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
  //   • Permissions-Policy is intentionally OMITTED: a restrictive camera/
  //     microphone policy would break the interview voice features.
  async headers() {
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

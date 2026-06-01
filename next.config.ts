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
    optimizePackageImports: ["framer-motion"],
  },
  // /pricing was the old EN static-HTML pricing route; Etappe C replaces it with
  // the German /preise. Keep old links alive with a permanent (308) redirect.
  async redirects() {
    return [{ source: "/pricing", destination: "/preise", permanent: true }];
  },
};

// next-intl: point the plugin at the request config (i18n without routing).
// Wraps the config above WITHOUT replacing it — serverExternalPackages and
// outputFileTracingIncludes are preserved.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);

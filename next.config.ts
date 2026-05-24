import type { NextConfig } from "next";

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
};

export default nextConfig;

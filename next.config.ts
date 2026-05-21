import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit ships .afm font-metric files that must be read from node_modules at
  // runtime. Keeping it external prevents the bundler from breaking those reads
  // on Vercel serverless.
  serverExternalPackages: ["pdfkit"],
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },
};

export default nextConfig;

import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 60_000,
    hookTimeout: 30_000,
    include: ["src/**/*.test.ts", "evals/**/*.eval.ts"],
    exclude: ["node_modules", ".next", "dist"],
  },
  resolve: {
    alias: {
      // MUST precede the "@" alias (matched first): the real "@/auth"
      // (src/auth.ts) pulls in next-auth, whose internal `next/server` import
      // fails to resolve under pnpm+Vitest. Unit tests mock the session, so we
      // stub the module. See src/test/auth.ts.
      "@/auth": path.resolve(__dirname, "./src/test/auth.ts"),
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/server-only.ts"),
      // next-intl/server resolves to a throwing client stub outside the RSC
      // `react-server` export condition (i.e. in Vitest's node env). Route
      // handlers run only in the server graph in prod, so we stub the
      // server-context helpers for tests. See src/test/next-intl-server.ts.
      "next-intl/server": path.resolve(
        __dirname,
        "./src/test/next-intl-server.ts",
      ),
    },
  },
});

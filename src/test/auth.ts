/**
 * Test stub for `@/auth` (the NextAuth v5 config in src/auth.ts).
 *
 * The real module imports `next-auth`, whose internal `next-auth/lib/env.js`
 * does `import … from "next/server"`. Under pnpm's strict node_modules layout
 * Vitest resolves that relative to next-auth's own package dir — where `next`
 * is not a sibling — and fails with "Cannot find module …/next/server". Unit
 * tests never need the real NextAuth runtime (they mock `auth()` / the session),
 * so `vitest.config.ts` aliases `@/auth` to these inert doubles, mirroring the
 * existing `next-intl/server` and `server-only` test aliases.
 *
 * Default `auth()` returns null (signed-out). A test that needs a populated
 * session mocks this module explicitly, e.g.
 *   vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: {…} }) }))
 */

export async function auth(): Promise<null> {
  return null;
}

export async function signIn(): Promise<undefined> {
  return undefined;
}

export async function signOut(): Promise<undefined> {
  return undefined;
}

export const handlers = {
  GET: async () => new Response(null),
  POST: async () => new Response(null),
};

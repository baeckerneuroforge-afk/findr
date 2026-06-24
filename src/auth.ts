import NextAuth from "next-auth";
import Zitadel from "next-auth/providers/zitadel";
import type { JWT } from "next-auth/jwt";

/**
 * Central NextAuth v5 (Auth.js) configuration — the single source of truth for
 * authentication. Replaces Clerk's hosted auth with Zitadel OIDC.
 *
 * SCOPE (Clerk→Zitadel migration, step 1): this wires up the LOGIN only and
 * exposes a stable user identity (the Zitadel `sub`) as `session.user.id`. The
 * org/tenant model (requireOrgId, Clerk Organizations, Supabase RLS token) is
 * deliberately NOT migrated here — that is the separate step 2.
 *
 * Exports the four v5 primitives used across the app:
 *   • handlers  → app/api/auth/[...nextauth]/route.ts (creates /api/auth/callback/zitadel)
 *   • auth      → proxy.ts middleware AND server-side `await auth()` session reads
 *   • signIn    → server action behind the /sign-in + /sign-up buttons
 *   • signOut   → sign-out action (used by the dashboard once step 2 lands)
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  // OIDC sessions are JWT-backed (no DB adapter): the Zitadel subject lives in
  // the token and is surfaced as session.user.id by the session() callback.
  session: { strategy: "jwt" },
  // Vercel preview deploys and the prod www host sit behind proxies; trust the
  // forwarded host so callback-URL detection matches the registered redirect
  // URI (https://www.klymeo.com/api/auth/callback/zitadel).
  trustHost: true,
  pages: {
    // Route NextAuth's own redirects to our branded page instead of the
    // built-in /api/auth/signin screen. proxy.ts also sends unauthenticated
    // /dashboard + /onboarding traffic here.
    signIn: "/sign-in",
  },
  providers: [
    Zitadel({
      // clientId / clientSecret / issuer are inferred from AUTH_ZITADEL_ID,
      // AUTH_ZITADEL_SECRET and AUTH_ZITADEL_ISSUER. Two relevant Auth.js
      // defaults apply implicitly and match the Zitadel app config:
      //   • PKCE S256 (default for any OIDC provider), and
      //   • client_secret_basic at the token endpoint (the app's "Basic" auth).
      authorization: {
        params: {
          // offline_access is REQUIRED for Zitadel to issue a refresh token;
          // the jwt() callback below performs refresh-token rotation.
          scope: "openid profile email offline_access",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // 1) Initial sign-in: persist the stable subject + the OIDC tokens.
      if (account) {
        token.sub = (profile?.sub as string | undefined) ?? token.sub;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        token.error = undefined;
        return token;
      }

      // 2) Access token still valid → reuse the token unchanged.
      if (token.expiresAt && Date.now() < token.expiresAt * 1000) {
        return token;
      }

      // 3) Expired → rotate via the refresh token. On failure flag the session
      //    so the UI can prompt a fresh sign-in instead of looping silently.
      if (!token.refreshToken) {
        token.error = "RefreshTokenError";
        return token;
      }
      try {
        return await rotateZitadelToken(token);
      } catch {
        token.error = "RefreshTokenError";
        return token;
      }
    },
    async session({ session, token }) {
      // Stable Zitadel identity for app code — this is the value that replaces
      // Clerk's user_id wherever step 2 rewires the data layer.
      if (session.user) {
        session.user.id = token.sub ?? "";
      }
      session.error = token.error;
      return session;
    },
  },
});

/**
 * Exchange the stored refresh token for a fresh access token at Zitadel's OAuth
 * token endpoint, using HTTP Basic client auth (client_secret_basic). Zitadel
 * rotates the refresh token on each use, so the new one is stored when present.
 */
async function rotateZitadelToken(token: JWT): Promise<JWT> {
  const issuer = process.env.AUTH_ZITADEL_ISSUER;
  const clientId = process.env.AUTH_ZITADEL_ID;
  const clientSecret = process.env.AUTH_ZITADEL_SECRET;
  if (!issuer || !clientId || !clientSecret || !token.refreshToken) {
    throw new Error("Missing Zitadel refresh configuration");
  }

  const response = await fetch(`${issuer}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // client_secret_basic: base64(clientId:clientSecret) in the Auth header.
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    }),
  });

  const refreshed: unknown = await response.json();
  if (!response.ok) throw refreshed;
  const data = refreshed as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  return {
    ...token,
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + Number(data.expires_in),
    // Keep the previous refresh token if Zitadel did not rotate it this time.
    refreshToken: data.refresh_token ?? token.refreshToken,
    error: undefined,
  };
}

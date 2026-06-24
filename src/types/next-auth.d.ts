import type { DefaultSession } from "next-auth";

/**
 * Module augmentation for NextAuth v5. Adds the app-specific fields the auth.ts
 * callbacks populate so they are type-safe across the codebase.
 */
declare module "next-auth" {
  interface Session {
    user: {
      /** Stable Zitadel subject (OIDC `sub`) — the canonical app user id. */
      id: string;
    } & DefaultSession["user"];
    /** Set when refresh-token rotation fails; the UI should prompt re-auth. */
    error?: "RefreshTokenError";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** Zitadel access token (used later for API/refresh; `sub` is the identity). */
    accessToken?: string;
    /** Zitadel refresh token (rotated by the jwt() callback). */
    refreshToken?: string;
    /** Access-token expiry, seconds since epoch (mirrors account.expires_at). */
    expiresAt?: number;
    error?: "RefreshTokenError";
  }
}

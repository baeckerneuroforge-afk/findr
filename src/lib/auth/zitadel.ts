import "server-only";

/**
 * URL of the Zitadel hosted console, where users manage their account and
 * organization (profile, members, roles) — the destination that replaces
 * Clerk's in-app <UserProfile>/<OrganizationProfile> surfaces. Derived from the
 * Zitadel issuer; falls back to the known prod issuer when the env var is
 * absent (e.g. during build).
 */
export function zitadelConsoleUrl(): string {
  const issuer = process.env.AUTH_ZITADEL_ISSUER ?? "https://auth.klymeo.com";
  return `${issuer.replace(/\/+$/, "")}/ui/console`;
}

import "server-only";

import { cache } from "react";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getDevOrgId } from "./dev-org";

export type OrgResolutionCode = "no_auth" | "no_org" | "org_not_in_db";

export class OrgResolutionError extends Error {
  constructor(
    message: string,
    public code: OrgResolutionCode,
  ) {
    super(message);
    this.name = "OrgResolutionError";
  }
}

function canUseDevOrgFallback(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.ALLOW_DEV_ORG_FALLBACK === "true" ||
      process.env.NEXT_PUBLIC_ALLOW_DEV_ORG_FALLBACK === "true")
  );
}

async function syncZitadelOrgToSupabase(
  zitadelOrgId: string,
  orgName: string | undefined,
): Promise<string> {
  try {
    const supabase = createAdminSupabaseClient();

    // Auto-mirror: the org lives in Zitadel (one customer = one Zitadel org).
    // On first login we mirror it into the organizations table, keyed by
    // zitadel_org_id; the name comes from the Zitadel resource-owner claim, so
    // there is no IdP SDK round-trip (unlike the old Clerk sync).
    const { data, error } = await supabase
      .from("organizations")
      .upsert(
        {
          zitadel_org_id: zitadelOrgId,
          name: orgName && orgName.trim() ? orgName : "Organization",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "zitadel_org_id" },
      )
      .select("id")
      .single();

    if (error || !data) {
      throw new OrgResolutionError(
        `Zitadel org ${zitadelOrgId} could not be synced to organizations table`,
        "org_not_in_db",
      );
    }

    return (data as { id: string }).id;
  } catch (err) {
    if (err instanceof OrgResolutionError) throw err;
    throw new OrgResolutionError(
      `Zitadel org ${zitadelOrgId} could not be synced to organizations table`,
      "org_not_in_db",
    );
  }
}

/**
 * Resolves the current Zitadel org (resource owner) to an internal
 * organizations.id (UUID). Throws OrgResolutionError if the user is not
 * authenticated or has no active org.
 *
 * Identity comes from the NextAuth session (Zitadel): session.user.id = sub,
 * session.user.orgId = the Zitadel organization id. In local development only,
 * ALLOW_DEV_ORG_FALLBACK=true can fall back to the demo org UUID for signed-in
 * users with no active org.
 *
 * Wrapped in React `cache()`: nearly every dashboard page/layout/service calls
 * this, so within a single request the `auth()` read AND the `organizations`
 * lookup (and the cold-start upsert) now run ONCE and are shared by all callers
 * instead of repeating the round-trip per call. `cache()` is scoped to the
 * current request — each request gets its own memoization, so there is no
 * cross-request/cross-user leakage. No behavior change, fewer DB round-trips.
 */
export const requireOrgId = cache(async (): Promise<string> => {
  const session = await auth();
  const userId = session?.user?.id;
  const zitadelOrgId = session?.user?.orgId;

  if (!userId) {
    throw new OrgResolutionError("Not authenticated", "no_auth");
  }

  if (!zitadelOrgId) {
    if (canUseDevOrgFallback()) {
      return getDevOrgId();
    }
    throw new OrgResolutionError("No active organization", "no_org");
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("zitadel_org_id", zitadelOrgId)
    .maybeSingle();

  if (error) {
    throw new OrgResolutionError(
      `Zitadel org ${zitadelOrgId} not found in organizations table`,
      "org_not_in_db",
    );
  }

  if (!data) {
    return syncZitadelOrgToSupabase(zitadelOrgId, session?.user?.orgName);
  }

  return (data as { id: string }).id;
});

/**
 * Resolve the human-readable org name for an internal org UUID.
 * Falls back to "Your Organization" if not found — never throws.
 *
 * Wrapped in React `cache()`: a single render path often resolves the same
 * org name more than once (page + the services it calls). Memoized per request
 * and keyed by `orgId`, so repeat calls with the same id reuse one lookup.
 */
export const getOrgName = cache(async (orgId: string): Promise<string> => {
  try {
    const supabase = createAdminSupabaseClient();
    const { data } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle();
    const name = (data as { name?: string } | null)?.name;
    return name && name.trim().length > 0 ? name : "Your Organization";
  } catch {
    return "Your Organization";
  }
});

/**
 * Safe wrapper for API routes. Returns a discriminated union: either
 * `{ orgId }` on success, or `{ error }` containing a ready-to-return
 * NextResponse on failure.
 *
 * Usage:
 *   const orgOrError = await requireOrgIdOrError();
 *   if ("error" in orgOrError) return orgOrError.error;
 *   const orgId = orgOrError.orgId;
 */
export async function requireOrgIdOrError(): Promise<
  { orgId: string } | { error: NextResponse }
> {
  try {
    const orgId = await requireOrgId();
    return { orgId };
  } catch (err) {
    const t = await getTranslations("errors");
    if (err instanceof OrgResolutionError) {
      const status = err.code === "no_auth" ? 401 : 403;
      // Map the stable resolution code → a user-facing message. The raw
      // err.message (which can leak Clerk/DB details) stays server-side; `code`
      // remains in the payload as a stable, non-display discriminator.
      const message =
        err.code === "no_auth"
          ? t("unauthorized")
          : err.code === "no_org"
            ? t("settings.noActiveOrg")
            : t("settings.couldNotResolveOrg");
      return {
        error: NextResponse.json({ error: message, code: err.code }, { status }),
      };
    }
    return {
      error: NextResponse.json({ error: t("unexpected") }, { status: 500 }),
    };
  }
}

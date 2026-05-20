import "server-only";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
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

async function syncClerkOrgToSupabase(clerkOrgId: string): Promise<string> {
  try {
    const client = await clerkClient();
    const clerkOrg = await client.organizations.getOrganization({
      organizationId: clerkOrgId,
    });
    const supabase = createAdminSupabaseClient();

    const { data, error } = await supabase
      .from("organizations")
      .upsert(
        {
          clerk_org_id: clerkOrgId,
          name: clerkOrg.name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "clerk_org_id" },
      )
      .select("id")
      .single();

    if (error || !data) {
      throw new OrgResolutionError(
        `Clerk org ${clerkOrgId} could not be synced to organizations table`,
        "org_not_in_db",
      );
    }

    return (data as { id: string }).id;
  } catch (err) {
    if (err instanceof OrgResolutionError) throw err;
    throw new OrgResolutionError(
      `Clerk org ${clerkOrgId} could not be synced to organizations table`,
      "org_not_in_db",
    );
  }
}

/**
 * Resolves the current Clerk org to an internal organizations.id (UUID).
 * Throws OrgResolutionError if the user is not authenticated or has no
 * active org.
 *
 * In local development only, ALLOW_DEV_ORG_FALLBACK=true can fall back to the
 * demo org UUID for signed-in users with no active Clerk org.
 */
export async function requireOrgId(): Promise<string> {
  const { userId, orgId: clerkOrgId } = await auth();

  if (!userId) {
    throw new OrgResolutionError("Not authenticated", "no_auth");
  }

  if (!clerkOrgId) {
    if (canUseDevOrgFallback()) {
      return getDevOrgId();
    }
    throw new OrgResolutionError("No active organization", "no_org");
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("clerk_org_id", clerkOrgId)
    .maybeSingle();

  if (error) {
    throw new OrgResolutionError(
      `Clerk org ${clerkOrgId} not found in organizations table`,
      "org_not_in_db",
    );
  }

  if (!data) {
    return syncClerkOrgToSupabase(clerkOrgId);
  }

  return (data as { id: string }).id;
}

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
    if (err instanceof OrgResolutionError) {
      const status = err.code === "no_auth" ? 401 : 403;
      return {
        error: NextResponse.json(
          { error: err.message, code: err.code },
          { status },
        ),
      };
    }
    return {
      error: NextResponse.json(
        { error: "Internal error resolving org" },
        { status: 500 },
      ),
    };
  }
}

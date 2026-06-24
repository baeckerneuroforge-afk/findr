import "server-only";

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { hasAdminRole } from "./roles";

export interface SettingsAdminContext {
  /** Internal organizations.id (UUID) — what every settings mutation scopes by. */
  orgId: string;
  /** Zitadel subject (sub) of the acting admin. */
  userId: string;
}

/**
 * Server-side admin gate behind every settings-mutation route. Reads identity
 * from the NextAuth/Zitadel session (replaces Clerk's auth().{userId,orgId,
 * orgRole}); admin is decided by hasAdminRole() over the Zitadel role claim.
 */
export async function requireSettingsAdminOrError(): Promise<
  SettingsAdminContext | { error: NextResponse }
> {
  const t = await getTranslations("errors");
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return {
      error: NextResponse.json(
        { success: false, error: t("unauthorized") },
        { status: 401 },
      ),
    };
  }

  if (!session?.user?.orgId) {
    return {
      error: NextResponse.json(
        { success: false, error: t("settings.noActiveOrg") },
        { status: 403 },
      ),
    };
  }

  if (!hasAdminRole(session.user.roles)) {
    return {
      error: NextResponse.json(
        { success: false, error: t("settings.adminOnly") },
        { status: 403 },
      ),
    };
  }

  try {
    const orgId = await requireOrgId();
    return { orgId, userId };
  } catch (err) {
    if (err instanceof OrgResolutionError) {
      const message =
        err.code === "no_auth"
          ? t("unauthorized")
          : err.code === "no_org"
            ? t("settings.noActiveOrg")
            : t("settings.couldNotResolveOrg");
      return {
        error: NextResponse.json(
          { success: false, error: message, code: err.code },
          { status: err.code === "no_auth" ? 401 : 403 },
        ),
      };
    }

    return {
      error: NextResponse.json(
        { success: false, error: t("settings.couldNotResolveOrg") },
        { status: 500 },
      ),
    };
  }
}

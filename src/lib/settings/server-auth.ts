import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { isAdminRole } from "./roles";

export interface SettingsAdminContext {
  orgId: string;
  clerkOrgId: string;
  userId: string;
  orgRole: string;
}

export async function requireSettingsAdminOrError(): Promise<
  SettingsAdminContext | { error: NextResponse }
> {
  const t = await getTranslations("errors");
  const session = await auth();
  if (!session.userId) {
    return {
      error: NextResponse.json(
        { success: false, error: t("unauthorized") },
        { status: 401 },
      ),
    };
  }

  if (!session.orgId) {
    return {
      error: NextResponse.json(
        { success: false, error: t("settings.noActiveOrg") },
        { status: 403 },
      ),
    };
  }

  if (!isAdminRole(session.orgRole)) {
    return {
      error: NextResponse.json(
        { success: false, error: t("settings.adminOnly") },
        { status: 403 },
      ),
    };
  }

  try {
    const orgId = await requireOrgId();
    return {
      orgId,
      clerkOrgId: session.orgId,
      userId: session.userId,
      orgRole: session.orgRole ?? "",
    };
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

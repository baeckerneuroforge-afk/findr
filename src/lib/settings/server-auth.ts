import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
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
  const session = await auth();
  if (!session.userId) {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  if (!session.orgId) {
    return {
      error: NextResponse.json(
        { success: false, error: "No active organization" },
        { status: 403 },
      ),
    };
  }

  if (!isAdminRole(session.orgRole)) {
    return {
      error: NextResponse.json(
        { success: false, error: "Only organization admins can do this" },
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
      return {
        error: NextResponse.json(
          { success: false, error: err.message, code: err.code },
          { status: err.code === "no_auth" ? 401 : 403 },
        ),
      };
    }

    return {
      error: NextResponse.json(
        { success: false, error: "Could not resolve organization" },
        { status: 500 },
      ),
    };
  }
}

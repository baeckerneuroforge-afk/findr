import { NextResponse } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { getEarlyWarnings } from "@/lib/loss/early-warning-service";

export async function GET() {
  // Canonical auth gate: returns a ready, locale-aware error response (and a
  // stable `code`) instead of leaking the raw resolution code as the message.
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const report = await getEarlyWarnings(orgOrError.orgId);
  return NextResponse.json(report);
}

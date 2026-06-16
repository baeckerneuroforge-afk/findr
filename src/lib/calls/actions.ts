"use server";

import { requireOrgId } from "@/lib/auth/org";
import { getCallById, type CallRow } from "./service";

/**
 * On-demand loader for a single call's full detail (transcript + speakers +
 * segments). The Deal-Detail page renders only lean DealCallSummary rows; the
 * CallDetail client component invokes this when the user expands a call, so the
 * heavy joins travel over the wire ONE call at a time instead of eager for
 * every call on the page.
 *
 * A Server Function is directly POST-reachable (not just via our UI), so auth
 * is verified here, every time: requireOrgId() throws for unauthenticated /
 * no-org callers, and getCallById is org-scoped (.eq("org_id", orgId)) — a
 * caller can never read a call from another org. callId is untrusted input but
 * is only ever bound as an .eq() filter value (no injection); an unknown id
 * simply yields null.
 */
export async function loadCallDetail(callId: string): Promise<CallRow | null> {
  const orgId = await requireOrgId();
  return getCallById(orgId, callId);
}

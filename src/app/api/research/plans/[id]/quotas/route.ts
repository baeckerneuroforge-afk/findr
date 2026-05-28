import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { upsertQuota } from "@/lib/research/participant-pool";

/**
 * POST /api/research/plans/[id]/quotas — manuelle Screening-Quote setzen
 * (Upsert auf (plan_id, role): "Ziel N Personen mit Rolle X" für diese
 * Studie). Reads laufen über die Server-Component (listQuotaProgress).
 *
 * Auth + Plan-Ownership wie POST /invites.
 */

const BodySchema = z.object({
  role: z.string().trim().min(1).max(80),
  target: z.number().int().min(0).max(100000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;

  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json({ error: "Research plan not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await upsertQuota(orgId, planId, parsed.data.role, parsed.data.target);
  if (result.status !== "ok") {
    return NextResponse.json(
      { error: result.message ?? "Quote konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
  return NextResponse.json({ success: true, quota: result.quota });
}

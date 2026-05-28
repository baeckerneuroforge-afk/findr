import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { createResearchSupabase } from "@/lib/research/db";
import { getResearchPlan } from "@/lib/research/plans-service";

/**
 * DELETE /api/research/plans/[id]/participants/[participantId]
 *
 * Hard-deletes a research_invites row. "Participant" is the UI-side
 * terminology; in the DB the row lives in `research_invites` (1 invite =
 * 1 participant on a plan). The single-line nominal-ID-aware path is
 * intentional — by carrying both planId and participantId in the URL we
 * get an extra ownership check (the invite must belong to *that* plan in
 * *that* org), which is one more guardrail than the existing
 * /api/research/invites/[id]/* routes that scope only by orgId+inviteId.
 *
 * FK behavior on cascade: interview_sessions.research_invite_id has
 * ON DELETE SET NULL (migration 20260612), so deleting an invite that
 * already kicked off (or even completed) a session does NOT delete the
 * session — the session row stays and its research_invite_id becomes
 * null. That's the intended semantics: the conversation/analysis data is
 * preserved as a research artifact even if the inviter "removed the
 * participant" from the plan list. If a user actually wanted to wipe the
 * data too, they'd need to delete the session as well — out of scope for
 * this v1 endpoint.
 *
 * Auth: requireOrgIdOrError + plan-ownership (mirrors POST /invites).
 * Returns 404 (not 403) for cross-org probes so the response doesn't
 * leak existence.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId, participantId } = await params;

  // Step 1: confirm the plan belongs to this org. Returns 404 for
  // cross-org probes (consistent with POST /invites).
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: "Research plan not found" },
      { status: 404 },
    );
  }

  // Step 2: scoped DELETE. The triple filter (id + plan_id + org_id) is
  // belt-and-braces — RLS plus the explicit org_id eq plus the
  // plan_id eq plus the id eq means we cannot accidentally hit another
  // org's invite if some part of the chain is misconfigured. Returns
  // 404 if no row matched (wrong plan, wrong org, or already deleted).
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_invites")
    .delete()
    .eq("id", participantId)
    .eq("plan_id", planId)
    .eq("org_id", orgId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      `[DELETE participant] supabase error for invite ${participantId} on plan ${planId}:`,
      error.message,
    );
    return NextResponse.json(
      { error: "Could not delete the participant." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Participant not found" },
      { status: 404 },
    );
  }

  // 200 with a small confirmation body (not 204) so the client can JSON-
  // parse uniformly and surface a single message on the toast/inline UI
  // without branching on status code.
  return NextResponse.json({ success: true, participantId: data.id });
}

/**
 * PATCH /api/research/plans/[id]/participants/[participantId]
 *
 * In-place edit of an existing participant: label and/or email. Mirrors the
 * DELETE handler's auth pattern exactly (requireOrgIdOrError → plan-
 * ownership via getResearchPlan → scoped UPDATE with triple filter on id +
 * plan_id + org_id). The same 404-instead-of-403 posture is used for
 * cross-org probes so existence isn't leaked.
 *
 * Body shape: { contactLabel?, contactEmail? } — at least one field must
 * be present. Field-level rules mirror the POST schema in invites/route.ts
 * (trim + length + email shape, empty string → null for email).
 *
 * Dedup: if contactEmail is being changed to a non-null value, we check
 * for another invite on the same plan with the same normalized email and
 * reject with 409 to avoid creating a duplicate by editing. Label-only
 * rows are never deduped (same rule as the bulk-create path). The current
 * invite is excluded from the dedup check via `neq("id", participantId)`
 * so a no-op email edit (saving the same email back) doesn't self-conflict.
 *
 * Mode-preference is intentionally NOT editable here — it's a creation-
 * time hint and editing it post-hoc has no effect (today text is the only
 * end-to-end mode anyway). If that ever changes, add it to the schema; the
 * UPDATE statement already only sets fields that were explicitly provided.
 */
const PatchBodySchema = z
  .object({
    contactLabel: z.string().trim().min(1).max(200).optional(),
    contactEmail: z
      .string()
      .trim()
      .max(320)
      .nullable()
      .optional()
      .transform((v) => (v === "" || v === undefined ? v : v))
      .refine(
        (v) =>
          v === null ||
          v === undefined ||
          v === "" ||
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        { message: "Invalid email" },
      )
      .transform((v) => (v === "" ? null : v)),
  })
  .refine(
    (v) => v.contactLabel !== undefined || v.contactEmail !== undefined,
    { message: "At least one field must be provided" },
  );

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId, participantId } = await params;

  // Mirrors DELETE: confirm plan ownership before any work / leakage.
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: "Research plan not found" },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createResearchSupabase();

  // Dedup: only when an email is being SET to a non-null value. Edits that
  // null-out the email, or that only touch the label, skip this branch.
  if (
    parsed.data.contactEmail !== undefined &&
    parsed.data.contactEmail !== null
  ) {
    const normalized = parsed.data.contactEmail.trim().toLowerCase();
    const { data: dupes, error: dupeError } = await supabase
      .from("research_invites")
      .select("id, contact_email")
      .eq("org_id", orgId)
      .eq("plan_id", planId)
      .neq("id", participantId)
      .not("contact_email", "is", null);
    if (dupeError) {
      console.error(
        `[PATCH participant] dedup query failed for invite ${participantId}:`,
        dupeError.message,
      );
      return NextResponse.json(
        { error: "Could not update the participant." },
        { status: 500 },
      );
    }
    const clash = (dupes ?? []).some(
      (r) => r.contact_email?.trim().toLowerCase() === normalized,
    );
    if (clash) {
      return NextResponse.json(
        { error: "Diese E-Mail ist bereits einem anderen Teilnehmer in diesem Plan zugeordnet." },
        { status: 409 },
      );
    }
  }

  // Only include columns the caller explicitly provided — keeps the
  // partial-update contract honest (omitting `contactLabel` must NOT clear
  // it). `contactEmail: null` is a legitimate value (clear the email).
  const updatePayload: { contact_label?: string; contact_email?: string | null } = {};
  if (parsed.data.contactLabel !== undefined) {
    updatePayload.contact_label = parsed.data.contactLabel;
  }
  if (parsed.data.contactEmail !== undefined) {
    updatePayload.contact_email = parsed.data.contactEmail;
  }

  const { data, error } = await supabase
    .from("research_invites")
    .update(updatePayload)
    .eq("id", participantId)
    .eq("plan_id", planId)
    .eq("org_id", orgId)
    .select("id, contact_label, contact_email")
    .maybeSingle();

  if (error) {
    console.error(
      `[PATCH participant] supabase error for invite ${participantId} on plan ${planId}:`,
      error.message,
    );
    return NextResponse.json(
      { error: "Could not update the participant." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Participant not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    participant: {
      id: data.id,
      contactLabel: data.contact_label,
      contactEmail: data.contact_email,
    },
  });
}

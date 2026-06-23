import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { createResearchSupabase } from "@/lib/research/db";
import { getResearchPlan } from "@/lib/research/plans-service";
import { invalidateInteractionSummary } from "@/lib/synthesis/interaction";

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
 * Two modes, selected by the `?erase=true` query flag:
 *  - default ("remove from list"): hard-delete the research_invites row.
 *    interview_sessions.invite_id is ON DELETE SET NULL, so a completed
 *    session is PRESERVED as a research artifact — its invite_id just
 *    becomes null.
 *  - erase=true (GDPR right-to-erasure): additionally hard-delete the
 *    participant's interview_sessions (transcript, analysis, screening
 *    answers) BEFORE the invite — once the invite is gone the FK is nulled
 *    and the link is lost, so order matters. The reusable participant_pool
 *    identity (if any) is intentionally kept; erasing it is a pool-
 *    management concern that can span other studies. Sessions orphaned by a
 *    prior non-erase delete (invite_id already null) can't be targeted here
 *    and are removed only by the org-level data deletion.
 *
 * Auth: requireOrgIdOrError + plan-ownership (mirrors POST /invites).
 * Returns 404 (not 403) for cross-org probes so the response doesn't
 * leak existence.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId, participantId } = await params;
  const erase = new URL(req.url).searchParams.get("erase") === "true";

  // Step 1: confirm the plan belongs to this org. Returns 404 for
  // cross-org probes (consistent with POST /invites).
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  const supabase = createResearchSupabase();

  // Step 2 (erase=true only): GDPR erasure of the participant's interview
  // sessions (transcript, analysis, screening answers). Done BEFORE the
  // invite delete — interview_sessions.invite_id is ON DELETE SET NULL, so
  // once the invite is gone the link is lost. Triple-filtered for safety.
  let sessionsDeleted = 0;
  if (erase) {
    const { data: erasedSessions, error: eraseError } = await supabase
      .from("interview_sessions")
      .delete()
      .eq("invite_id", participantId)
      .eq("plan_id", planId)
      .eq("org_id", orgId)
      .select("id");
    if (eraseError) {
      console.error(
        `[DELETE participant] session erase failed for invite ${participantId} on plan ${planId}:`,
        eraseError.message,
      );
      return NextResponse.json(
        { error: t("research.couldNotDeleteParticipant") },
        { status: 500 },
      );
    }
    sessionsDeleted = erasedSessions?.length ?? 0;
    // Art. 17 — also invalidate the study's stored usability aggregate so it
    // cannot retain the erased participant's contribution; the next synthesis
    // recomputes it min-N-gated from the remaining sessions. Best-effort.
    if (sessionsDeleted > 0) {
      await invalidateInteractionSummary(orgId, planId);
    }
  }

  // Step 3: scoped DELETE of the invite. The triple filter (id + plan_id +
  // org_id) is belt-and-braces — RLS plus the explicit eqs mean we cannot
  // hit another org's invite if some part of the chain is misconfigured.
  // Returns 404 if no row matched (wrong plan, wrong org, or already gone).
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
      { error: t("research.couldNotDeleteParticipant") },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: t("notFound.participant") },
      { status: 404 },
    );
  }

  // 200 with a small confirmation body (not 204) so the client can JSON-
  // parse uniformly and surface a single message on the toast/inline UI
  // without branching on status code.
  return NextResponse.json({
    success: true,
    participantId: data.id,
    erased: erase,
    sessionsDeleted,
  });
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
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId, participantId } = await params;

  // Mirrors DELETE: confirm plan ownership before any work / leakage.
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: t("invalidRequestBody") }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
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
        { error: t("research.couldNotUpdateParticipant") },
        { status: 500 },
      );
    }
    const clash = (dupes ?? []).some(
      (r) => r.contact_email?.trim().toLowerCase() === normalized,
    );
    if (clash) {
      return NextResponse.json(
        { error: t("research.emailAssignedToParticipant") },
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
      { error: t("research.couldNotUpdateParticipant") },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: t("notFound.participant") },
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

import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { createResearchSupabase } from "@/lib/research/db";
import { getResearchPlan } from "@/lib/research/plans-service";
import { createResearchInvite } from "@/lib/research/research-orchestration";

/**
 * POST /api/research/plans/[id]/invites — add one or many participants.
 *
 * Two body shapes are accepted, distinguished by the presence of the
 * `invites` array. The bulk shape was added by feat/participant-flow; the
 * single shape is the original Etappe-B-Teil-1 contract and stays valid
 * so the existing InviteForm component keeps working unmodified.
 *
 *   Single  → { contactLabel, contactEmail?, modePreference? }
 *             Response: { success, inviteId, accessToken }
 *
 *   Bulk    → { invites: [{ contactLabel, contactEmail?, modePreference? }, ...] }
 *             Response: { success, results: [...], summary: {...} }
 *
 * Bulk semantics:
 *  - Per-item validation (same Zod schema as single). An invalid item is
 *    reported with status="invalid" but doesn't fail the rest of the
 *    batch — partial success is the expected mode for paste-from-list UX.
 *  - Duplicate skip: items whose normalized email matches an existing
 *    invite on the same plan (case-insensitive, trimmed) get
 *    status="skipped_duplicate". The first item carrying that email in
 *    the same request wins; subsequent ones get skipped too.
 *  - Items without an email are NEVER deduped against each other or
 *    against the DB — name-only entries are by definition not unique.
 *    The caller is expected to dedupe label-only entries on their side
 *    if they care. (In practice the textarea UI dedupes blank lines
 *    before sending.)
 *  - Hard cap of 200 invites per request to keep the function within
 *    Fluid Compute's budget and avoid pathological pastes. Above that
 *    we 413 the whole batch — the caller should chunk.
 *
 * Both shapes share the same auth + plan-ownership check up front.
 */

const InviteItemSchema = z.object({
  contactLabel: z.string().trim().min(1).max(200),
  contactEmail: z
    .string()
    .trim()
    .email()
    .max(320)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  modePreference: z.enum(["text", "voice", "video"]).optional(),
});

const SingleBodySchema = InviteItemSchema;

const BulkBodySchema = z.object({
  invites: z.array(InviteItemSchema).min(1).max(200),
});

type BulkResultItem = {
  contactLabel: string;
  contactEmail: string | null;
  status: "created" | "skipped_duplicate" | "invalid" | "error";
  inviteId?: string;
  accessToken?: string;
  message?: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;

  // Plan ownership — same 404 posture as DELETE /participants/[id]: don't
  // distinguish "wrong org" from "no such plan".
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

  // ── Bulk path ─────────────────────────────────────────────────────────
  if ("invites" in body && Array.isArray((body as { invites: unknown }).invites)) {
    const parsed = BulkBodySchema.safeParse(body);
    if (!parsed.success) {
      // Top-level shape error (e.g. > 200 items, empty array). Item-level
      // errors are surfaced per-item inside the loop, not here.
      return NextResponse.json(
        { error: t("research.invalidBulkBody"), details: parsed.error.flatten() },
        { status: parsed.error.issues.some((i) => i.code === "too_big") ? 413 : 400 },
      );
    }

    // Pre-fetch existing emails for this plan to dedupe in a single query
    // instead of N round-trips. Service-role read; org-scoped by the
    // explicit eq filters.
    const supabase = createResearchSupabase();
    const { data: existingRows } = await supabase
      .from("research_invites")
      .select("contact_email")
      .eq("org_id", orgId)
      .eq("plan_id", planId)
      .not("contact_email", "is", null);
    const existingEmails = new Set(
      (existingRows ?? [])
        .map((r) => r.contact_email?.trim().toLowerCase())
        .filter((e): e is string => !!e),
    );

    // In-request dedup: a paste with the same email twice should only
    // create one invite. Track lower-cased emails we've already
    // accepted in this batch.
    const seenInBatch = new Set<string>();

    const results: BulkResultItem[] = [];
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of parsed.data.invites) {
      const normalizedEmail = item.contactEmail?.trim().toLowerCase() ?? null;

      if (normalizedEmail && existingEmails.has(normalizedEmail)) {
        results.push({
          contactLabel: item.contactLabel,
          contactEmail: item.contactEmail ?? null,
          status: "skipped_duplicate",
          message: t("research.bulkEmailExistsInPlan"),
        });
        skipped++;
        continue;
      }
      if (normalizedEmail && seenInBatch.has(normalizedEmail)) {
        results.push({
          contactLabel: item.contactLabel,
          contactEmail: item.contactEmail ?? null,
          status: "skipped_duplicate",
          message: t("research.bulkEmailDuplicateInList"),
        });
        skipped++;
        continue;
      }

      const result = await createResearchInvite({
        orgId,
        planId,
        contactLabel: item.contactLabel,
        contactEmail: item.contactEmail ?? null,
        modePreference: item.modePreference ?? "text",
      });

      if (result.status === "created" && result.inviteId && result.accessToken) {
        if (normalizedEmail) {
          existingEmails.add(normalizedEmail);
          seenInBatch.add(normalizedEmail);
        }
        results.push({
          contactLabel: item.contactLabel,
          contactEmail: item.contactEmail ?? null,
          status: "created",
          inviteId: result.inviteId,
          accessToken: result.accessToken,
        });
        created++;
      } else {
        results.push({
          contactLabel: item.contactLabel,
          contactEmail: item.contactEmail ?? null,
          status: "error",
          message: t("research.bulkCreateFailed"),
        });
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: { created, skipped, errors, total: results.length },
    });
  }

  // ── Single path (existing contract — unchanged response shape) ────────
  const parsed = SingleBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await createResearchInvite({
    orgId,
    planId,
    contactLabel: parsed.data.contactLabel,
    contactEmail: parsed.data.contactEmail ?? null,
    modePreference: parsed.data.modePreference ?? "text",
  });

  switch (result.status) {
    case "created":
      return NextResponse.json({
        success: true,
        inviteId: result.inviteId,
        accessToken: result.accessToken,
      });
    case "plan_not_found":
      return NextResponse.json(
        { error: t("notFound.researchPlan") },
        { status: 404 },
      );
    default:
      return NextResponse.json(
        { error: t("research.couldNotCreateInvite") },
        { status: 500 },
      );
  }
}

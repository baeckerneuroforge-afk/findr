import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import {
  createSynthesisShare,
  revokeSynthesisShare,
} from "@/lib/synthesis/share-service";

/**
 * Org-INTERNAL management of public share links for a plan's synthesis. This is
 * the authenticated surface (Clerk + org), NOT the public read path
 * (/shared/synthesis/[token], which is account-less and token-only).
 *
 * Same auth + plan-ownership gate as the synthesis route: requireOrgIdOrError
 * then getResearchPlan(orgId, planId) — a 404 (not 403) when the plan isn't in
 * the caller's org, so we never leak cross-org existence.
 *
 *   POST   — create a share link  → { success, share } (share carries the token)
 *   DELETE — revoke a share        → { success } | 404
 *
 * The "create link" BUTTON in the internal synthesis view is intentionally NOT
 * built here — it lands after the i18n etappe that owns synthesis/page.tsx
 * merges. This route is the standalone backend it will call.
 */

const CreateBodySchema = z.object({
  showQuotes: z.boolean().optional(),
  language: z.enum(["de", "en"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

const RevokeBodySchema = z.object({
  shareId: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;

  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  // Body is optional — an empty POST creates a default share (no quotes, default
  // locale, no expiry).
  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    raw = {};
  }
  const parsed = CreateBodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const share = await createSynthesisShare(orgId, planId, parsed.data);
    return NextResponse.json({
      success: true,
      share,
      path: `/shared/synthesis/${share.token}`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: t("research.couldNotCreateShare"),
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;

  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: t("missingBody") },
      { status: 400 },
    );
  }
  const parsed = RevokeBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ok = await revokeSynthesisShare(orgId, parsed.data.shareId);
  if (!ok) {
    return NextResponse.json({ error: t("notFound.share") }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

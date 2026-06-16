import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  createProlificDraftForPlan,
  ProlificDraftError,
} from "@/lib/panel/service";
import { ProlificApiError } from "@/lib/panel/prolific";

const BodySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(4_000),
    totalAvailablePlaces: z.number().int().min(1).max(1_000_000),
    estimatedCompletionTime: z.number().int().min(1).max(24 * 60),
    rewardCents: z.number().int().min(1).max(10_000_000),
    screenoutRewardCents: z.number().int().min(10).max(10_000_000),
    screenoutSlots: z.number().int().min(1).max(10_000_000),
  })
  .refine((v) => v.screenoutRewardCents < v.rewardCents, {
    path: ["screenoutRewardCents"],
    message: "screenout_reward_must_be_less_than_reward",
  });

function draftErrorStatus(code: ProlificDraftError["code"]) {
  if (code === "plan_not_found") return 404;
  if (code === "missing_credentials") return 400;
  if (code === "open_link_missing") return 400;
  if (code === "open_link_disabled") return 400;
  return 500;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: t("invalidRequestBody"),
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { id: planId } = await params;

  try {
    const result = await createProlificDraftForPlan(
      orgOrError.orgId,
      planId,
      parsed.data,
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof ProlificDraftError) {
      return NextResponse.json(
        { success: false, error: err.code },
        { status: draftErrorStatus(err.code) },
      );
    }
    if (err instanceof ProlificApiError) {
      return NextResponse.json(
        {
          success: false,
          error: "prolific_api_error",
          status: err.status,
        },
        { status: err.status >= 400 && err.status < 500 ? 400 : 502 },
      );
    }
    console.error("[panel/prolific-draft] failed:", err);
    return NextResponse.json(
      { success: false, error: t("unexpected") },
      { status: 500 },
    );
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import type { Json } from "@/types/database";
import {
  createVisualCaptureFromBrowserFrames,
  DEFAULT_MAX_VISUAL_FRAMES,
  DEFAULT_SAMPLE_EVERY_SECONDS,
} from "@/lib/visual-intelligence/vision";
import {
  applyVisualCaptureToCompletedResearchTranscript,
  resolveVisualCaptureSession,
} from "@/lib/research/transcript-service";
import { getResearchPlan } from "@/lib/research/plans-service";
import { assertCaptureConsent } from "@/lib/research/capture-consent";

/**
 * POST /api/interview/[token]/visual-capture
 *
 * Public participant route, scoped by the same unguessable interview token as
 * /api/interview/[token]. We intentionally do NOT require a Voice Bearer token:
 * a public browser must never receive an org-scoped API secret. The server reads
 * org_id from the token-owned interview_session row and every write is scoped
 * to that org.
 *
 * The request contains short-lived, downscaled browser frames only. The route
 * turns them into text observations synchronously, stores only the text/metadata
 * capture payload, appends that block to calls.transcript, and reruns the
 * existing Stage-1 Product Discovery entry point.
 */

export const maxDuration = 300;

const MAX_FRAME_BASE64_CHARS = 300_000;
const MAX_TOTAL_BASE64_CHARS = 4_800_000;

const TokenSchema = z.string().min(20).max(200);

const FrameSchema = z.object({
  index: z.number().int().min(0).max(10_000),
  timestampSeconds: z.number().finite().min(0).max(60 * 60),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z.string().min(32).max(MAX_FRAME_BASE64_CHARS),
});

const BodySchema = z
  .object({
    sampledEverySeconds: z
      .number()
      .int()
      .min(1)
      .max(60)
      .default(DEFAULT_SAMPLE_EVERY_SECONDS),
    truncated: z.boolean().default(false),
    frames: z.array(FrameSchema).min(1).max(DEFAULT_MAX_VISUAL_FRAMES),
  })
  .superRefine((value, ctx) => {
    const total = value.frames.reduce((sum, frame) => sum + frame.data.length, 0);
    if (total > MAX_TOTAL_BASE64_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frames"],
        message: "Frame payload is too large.",
      });
    }
  });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const { token } = await params;
  const tokenParsed = TokenSchema.safeParse(token);
  if (!tokenParsed.success) {
    return NextResponse.json(
      { error: t("interview.invalidLink") },
      { status: 400 },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    // Gate before spend: resolve the token-owned session and enforce the
    // per-study toggle BEFORE the vision LLM call. Mirrors the plan gates on
    // /speak (ttsEnabled) and /voice (voiceEnabled) — without this, an
    // invalid token or a study with visual capture disabled could still burn
    // a full vision call.
    const resolution = await resolveVisualCaptureSession(tokenParsed.data);
    if (!resolution.ok) {
      if (resolution.reason === "not_found") {
        return NextResponse.json(
          { error: t("notFound.interview") },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Visual capture is not available for this interview." },
        { status: 403 },
      );
    }
    const session = resolution.session;

    if (!session.plan_id) {
      return NextResponse.json(
        { error: "Visual capture is not available for this interview." },
        { status: 403 },
      );
    }
    const plan = await getResearchPlan(session.org_id, session.plan_id);
    if (!plan) {
      return NextResponse.json(
        { error: t("notFound.interview") },
        { status: 404 },
      );
    }
    if (plan.visualCaptureEnabled !== true) {
      return NextResponse.json(
        { error: "Visual capture is not enabled for this study." },
        { status: 403 },
      );
    }

    // C-A fix (integration plan L7, fail-closed): the per-study toggle alone is
    // NOT participant consent. Verify the stored SCREEN-tier opt-in
    // (screen_consent_at, stamped via POST /consent {purposes:['screen']} when
    // the participant accepted the screen-share panel). No stamp → 403, before
    // any vision spend. Pre-migration the column is absent → undefined → 403.
    if (!assertCaptureConsent(session, "screen")) {
      return NextResponse.json(
        { error: "Screen capture consent is missing for this session." },
        { status: 403 },
      );
    }

    const visualCapture = await createVisualCaptureFromBrowserFrames(
      parsed.data.frames,
      {
        sampleEverySeconds: parsed.data.sampledEverySeconds,
        maxFrames: DEFAULT_MAX_VISUAL_FRAMES,
        truncated: parsed.data.truncated,
      },
    );
    const result = await applyVisualCaptureToCompletedResearchTranscript({
      session,
      visualCapture: visualCapture as unknown as Json,
    });

    return NextResponse.json({
      success: true,
      callId: result.callId,
      discoveryRan: result.discoveryRan,
      createdCall: result.createdCall,
      frameCount: visualCapture.frameCount,
      truncated: visualCapture.truncated ?? false,
    });
  } catch (err) {
    console.error(
      "[visual-capture] processing failed:",
      err instanceof Error ? err.message : err,
    );
    // No `detail` in the response: raw upstream/DB messages stay server-side.
    return NextResponse.json({ error: t("unexpected") }, { status: 500 });
  }
}

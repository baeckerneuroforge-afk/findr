import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { isKonsoulP5Enabled } from "@/lib/konsoul/p5-flag";
import { logKonsoulMetric } from "@/lib/konsoul/metrics";

/**
 * Konsoul P5 — org-side TELEMETRY ingest. The inline-⌘K client fires lightweight
 * usage events here (question asked / answer shown / thread resumed). Metadata
 * ONLY: a closed event set + whitelisted numeric counts — never question/answer
 * text (the service drops everything else). Flag-gated (404 off). orgId is
 * server-authoritative. Always 200/204 on a valid body — telemetry is best-effort
 * and must never surface an error to the user flow.
 */

const BodySchema = z.object({
  event: z.enum(["inline_question_asked", "inline_answer_shown", "thread_resumed"]),
  counts: z.record(z.string(), z.number().int().nonnegative()).optional(),
});

function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isKonsoulP5Enabled()) return notFound();
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  await logKonsoulMetric({
    orgId: orgOrError.orgId,
    event: parsed.data.event,
    counts: parsed.data.counts,
  });
  return NextResponse.json({ success: true });
}

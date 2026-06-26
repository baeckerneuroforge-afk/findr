import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { isKonsoulP5Enabled } from "@/lib/konsoul/p5-flag";
import { listThreads, saveThread } from "@/lib/konsoul/threads/service";
import { logKonsoulMetric } from "@/lib/konsoul/metrics";

/**
 * Konsoul P5 — persisted-thread collection route.
 *   GET  /api/konsoul-agent/threads        → list the org's recent threads
 *   POST /api/konsoul-agent/threads        → create/update a thread {threadId?, turns}
 *
 * Flag-gated: if NEXT_PUBLIC_KONSOUL_P5_ENABLED is off the route 404s (inert —
 * nothing is ever written to konsoul_threads). orgId is SERVER-AUTHORITATIVE
 * (requireOrgIdOrError), never read from the body; the service additionally
 * scopes every query by org_id. Persistence is best-effort — a save failure
 * returns threadId:null, it never throws.
 */

const SaveSchema = z.object({
  threadId: z.string().uuid().optional(),
  turns: z
    .array(z.object({ role: z.string(), content: z.string().max(4000) }))
    .max(100),
});

function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(): Promise<NextResponse> {
  if (!isKonsoulP5Enabled()) return notFound();
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const threads = await listThreads(orgOrError.orgId);
  return NextResponse.json({ success: true, threads });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isKonsoulP5Enabled()) return notFound();
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = SaveSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await saveThread({
    orgId,
    threadId: parsed.data.threadId ?? null,
    turns: parsed.data.turns,
  });

  // org-side telemetry (metadata only) — fire-and-forget, never blocks the save.
  if (result.created) {
    void logKonsoulMetric({
      orgId,
      event: "thread_saved",
      // the PERSISTED turn count (post-sanitization), not the raw client length.
      counts: { turn_count: result.turnCount },
    });
  }

  return NextResponse.json({ success: true, threadId: result.threadId });
}

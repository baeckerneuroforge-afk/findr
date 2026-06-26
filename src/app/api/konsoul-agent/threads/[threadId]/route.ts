import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { isKonsoulP5Enabled } from "@/lib/konsoul/p5-flag";
import { deleteThread, loadThread } from "@/lib/konsoul/threads/service";

/**
 * Konsoul P5 — single persisted thread.
 *   GET    /api/konsoul-agent/threads/[threadId] → its {role, content} turns
 *   DELETE /api/konsoul-agent/threads/[threadId] → remove it
 *
 * Flag-gated (404 when off). orgId is server-authoritative; the service scopes
 * every query by org_id, so a guessed/foreign threadId returns null/404 — never
 * another org's data.
 */

const IdSchema = z.string().uuid();

function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
): Promise<NextResponse> {
  if (!isKonsoulP5Enabled()) return notFound();
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const { threadId } = await params;
  if (!IdSchema.safeParse(threadId).success) return notFound();

  const turns = await loadThread(orgOrError.orgId, threadId);
  if (turns === null) return notFound();
  return NextResponse.json({ success: true, turns });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
): Promise<NextResponse> {
  if (!isKonsoulP5Enabled()) return notFound();
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const { threadId } = await params;
  if (!IdSchema.safeParse(threadId).success) return notFound();

  const ok = await deleteThread(orgOrError.orgId, threadId);
  return NextResponse.json({ success: ok });
}

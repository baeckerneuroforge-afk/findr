import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdFromBearer } from "@/lib/auth/voice-token";
import { VoiceIngestSchema } from "@/lib/schemas/voice-ingest";
import { routeIngestedCall, type VoiceCallInput } from "@/lib/voice/router";
import {
  findByExternalId,
  recordPending,
  recordRouted,
} from "@/lib/voice/inbox-service";

/**
 * POST /api/voice/ingest — Findr Voice ingest (Etappe 1).
 *
 * Auth: Bearer-Token (requireOrgIdFromBearer) — org-autoritativ, NIE aus dem
 * Body. Spiegelt das `.omit({orgId})`-Muster der bestehenden Routes; der Body
 * trägt kein orgId.
 *
 * Ablauf:
 *   1. Idempotenz: ein wiederholter externalMeetingId liefert das frühere
 *      Ergebnis zurück, KEIN zweiter Engine-Lauf.
 *   2. assignment.kind === "inbox" → recordPending (Posteingang, status pending).
 *   3. sonst → routeIngestedCall (genau eine Engine) → recordRouted (status routed).
 *
 * Surface:
 *   400  — non-JSON / ungültiger Body
 *   401  — kein/ungültiges Bearer-Token
 *   404  — Zuordnungsziel (Account/Deal/Plan) existiert nicht in dieser Org
 *   500  — Engine/DB warf
 *   200  — { success, status, engine?, callId?, resultRef?, inboxId, idempotent? }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const t = await getTranslations("errors");

  const orgOrError = await requireOrgIdFromBearer(request);
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: t("invalidJsonBody") }, { status: 400 });
  }

  const parsed = VoiceIngestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const input: VoiceCallInput = {
    transcriptText: body.transcriptText,
    externalMeetingId: body.externalMeetingId,
    recordedAt: body.recordedAt,
    durationSeconds: body.durationSeconds,
    segments: body.segments,
  };

  // 1) Idempotency — a repeat externalMeetingId returns the prior outcome.
  const existing = await findByExternalId(orgId, body.externalMeetingId);
  if (existing) {
    return NextResponse.json({
      success: true,
      idempotent: true,
      status: existing.status,
      engine: existing.engine,
      resultRef: existing.resultRef,
      inboxId: existing.id,
    });
  }

  try {
    // 2) Deferred → Posteingang.
    if (body.assignment.kind === "inbox") {
      const item = await recordPending(orgId, input);
      return NextResponse.json({
        success: true,
        status: "pending",
        inboxId: item.id,
      });
    }

    // 3) Direct → exactly one engine (the assignment narrows to RoutableAssignment).
    const route = await routeIngestedCall(orgId, input, body.assignment);
    if (!route.ok) {
      const message =
        route.code === "account_not_found"
          ? t("notFound.account")
          : route.code === "deal_not_found"
            ? t("notFound.deal")
            : t("notFound.researchPlan");
      return NextResponse.json({ error: message, code: route.code }, { status: 404 });
    }

    const item = await recordRouted(orgId, input, route);
    return NextResponse.json({
      success: true,
      status: "routed",
      engine: route.engine,
      callId: route.callId,
      resultRef: route.resultRef,
      inboxId: item.id,
    });
  } catch (err) {
    console.error(
      "[POST /api/voice/ingest] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: t("unexpected"),
      },
      { status: 500 },
    );
  }
}

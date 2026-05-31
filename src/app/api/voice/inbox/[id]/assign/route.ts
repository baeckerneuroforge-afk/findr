import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdFromBearer } from "@/lib/auth/voice-token";
import { AssignInboxSchema } from "@/lib/schemas/voice-ingest";
import { assignVoiceInboxItem } from "@/lib/voice/inbox-service";

/**
 * POST /api/voice/inbox/[id]/assign — Human-Gate: ein pending Posteingang-Item
 * einem Ziel (Account/Deal/Studie) zuordnen → läuft durch DENSELBEN
 * routeIngestedCall wie ein direkter Ingest und flippt die Zeile auf 'assigned'.
 *
 * Body: { assignment: RoutableAssignment } (kein "inbox" — dort liegt es schon).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const t = await getTranslations("errors");

  const orgOrError = await requireOrgIdFromBearer(request);
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;
  const { id } = await params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: t("invalidJsonBody") }, { status: 400 });
  }

  const parsed = AssignInboxSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await assignVoiceInboxItem(orgId, id, parsed.data.assignment);
  if (!result.ok) {
    switch (result.code) {
      case "not_found":
        return NextResponse.json(
          { error: "Posteingang-Eintrag nicht gefunden", code: result.code },
          { status: 404 },
        );
      case "not_pending":
        return NextResponse.json(
          { error: "Eintrag ist nicht mehr offen", code: result.code },
          { status: 409 },
        );
      case "missing_transcript":
        return NextResponse.json(
          { error: "Eintrag enthält kein Transkript", code: result.code },
          { status: 422 },
        );
      case "account_not_found":
        return NextResponse.json(
          { error: t("notFound.account"), code: result.code },
          { status: 404 },
        );
      case "deal_not_found":
        return NextResponse.json(
          { error: t("notFound.deal"), code: result.code },
          { status: 404 },
        );
      case "plan_not_found":
        return NextResponse.json(
          { error: t("notFound.researchPlan"), code: result.code },
          { status: 404 },
        );
    }
  }

  return NextResponse.json({
    success: true,
    status: result.item.status,
    engine: result.route.engine,
    callId: result.route.callId,
    resultRef: result.route.resultRef,
    inboxId: result.item.id,
  });
}

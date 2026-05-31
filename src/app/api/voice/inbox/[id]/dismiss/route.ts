import { NextResponse, type NextRequest } from "next/server";

import { requireOrgIdFromBearer } from "@/lib/auth/voice-token";
import { dismissVoiceInboxItem } from "@/lib/voice/inbox-service";

/**
 * POST /api/voice/inbox/[id]/dismiss — ein pending Posteingang-Item verwerfen
 * (schließt den Lebenszyklus ohne Engine-Lauf). 404 wenn der Eintrag fehlt oder
 * nicht mehr offen ist.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const orgOrError = await requireOrgIdFromBearer(request);
  if ("error" in orgOrError) return orgOrError.error;
  const { id } = await params;

  const item = await dismissVoiceInboxItem(orgOrError.orgId, id);
  if (!item) {
    return NextResponse.json(
      { error: "Posteingang-Eintrag nicht gefunden oder nicht offen", code: "not_found" },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, status: item.status, inboxId: item.id });
}

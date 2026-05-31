import { NextResponse, type NextRequest } from "next/server";

import { requireOrgIdFromBearer } from "@/lib/auth/voice-token";
import { listVoiceInbox } from "@/lib/voice/inbox-service";

/**
 * GET /api/voice/inbox — der Posteingang: Ingests mit "später zuordnen"
 * (status='pending'), neueste oben. Bearer-Auth wie die Ingest-Route, damit der
 * Desktop-Client (und curl im E1-Test) die Liste org-gescopt abrufen kann.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const orgOrError = await requireOrgIdFromBearer(request);
  if ("error" in orgOrError) return orgOrError.error;

  const items = await listVoiceInbox(orgOrError.orgId);
  return NextResponse.json({ success: true, items });
}

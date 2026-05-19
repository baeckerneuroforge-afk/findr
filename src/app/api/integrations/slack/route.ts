import { NextResponse, type NextRequest } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  upsertSlackIntegration,
  type SlackIntegrationConfig,
} from "@/lib/slack/service";

export async function POST(req: NextRequest) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  try {
    const body = (await req.json()) as SlackIntegrationConfig;
    if (!body.channel_id || !body.channel_name || !body.webhook_url) {
      return NextResponse.json(
        {
          success: false,
          error: "channel_id, channel_name and webhook_url are required",
        },
        { status: 400 },
      );
    }

    await upsertSlackIntegration(orgId, body);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

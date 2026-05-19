import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  upsertSlackIntegration,
  type SlackIntegrationConfig,
} from "@/lib/slack/service";

const FINDR_DEV_ORG_ID = "4909c8ee-017f-4d9a-bdb6-d3b90f0806a0";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as SlackIntegrationConfig;
    if (!body.channel_id || !body.channel_name || !body.webhook_url) {
      return NextResponse.json(
        { success: false, error: "channel_id, channel_name and webhook_url are required" },
        { status: 400 },
      );
    }

    await upsertSlackIntegration(FINDR_DEV_ORG_ID, body);
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

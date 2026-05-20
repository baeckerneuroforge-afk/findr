import { NextResponse, type NextRequest } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { upsertSlackIntegration } from "@/lib/slack/service";
import { SlackIntegrationConfigSchema } from "@/lib/schemas/slack";

export async function POST(req: NextRequest) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  try {
    const rawBody = await req.json();
    const parsed = SlackIntegrationConfigSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid configuration",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    await upsertSlackIntegration(orgId, parsed.data);
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

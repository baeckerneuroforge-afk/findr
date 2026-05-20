import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { buildGongAuthorizeUrl, isGongConfigured } from "@/lib/gong/service";

export async function GET() {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  if (!isGongConfigured()) {
    return NextResponse.json(
      {
        error: "Gong integration not configured",
        detail:
          "GONG_CLIENT_ID, GONG_CLIENT_SECRET, and GONG_REDIRECT_URI must be set before connecting Gong.",
        code: "GONG_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const state = randomBytes(32).toString("hex");
  const supabase = createAdminSupabaseClient();

  await supabase
    .from("oauth_states")
    .delete()
    .eq("provider", "gong")
    .lt("expires_at", new Date().toISOString());

  const { error } = await supabase.from("oauth_states").insert({
    org_id: orgOrError.orgId,
    state,
    provider: "gong",
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to create OAuth state", code: "STATE_CREATE_FAILED" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(buildGongAuthorizeUrl(state));
}

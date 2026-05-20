import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const HUBSPOT_SCOPES = [
  "crm.objects.deals.read",
  "crm.objects.companies.read",
  "crm.objects.contacts.read",
  "crm.objects.owners.read",
  "crm.schemas.deals.read",
];

export async function GET(request: Request) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/integrations/hubspot?error=missing_hubspot_env",
        request.url,
      ),
    );
  }

  const state = randomBytes(32).toString("hex");
  const supabase = createAdminSupabaseClient();

  await supabase
    .from("oauth_states")
    .delete()
    .eq("provider", "hubspot")
    .lt("expires_at", new Date().toISOString());

  const { error } = await supabase.from("oauth_states").insert({
    org_id: orgOrError.orgId,
    state,
    provider: "hubspot",
  });

  if (error) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/integrations/hubspot?error=state_create_failed",
        request.url,
      ),
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: HUBSPOT_SCOPES.join(" "),
    state,
  });

  return NextResponse.redirect(
    `https://app.hubspot.com/oauth/authorize?${params.toString()}`,
  );
}

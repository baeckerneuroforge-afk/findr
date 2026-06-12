import { NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  introspectAccessToken,
  saveHubspotIntegration,
} from "@/lib/hubspot/service";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

function redirectToHubspotSettings(request: Request, params: URLSearchParams) {
  return NextResponse.redirect(
    new URL(`/dashboard/integrations/hubspot?${params.toString()}`, request.url),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return redirectToHubspotSettings(
      request,
      new URLSearchParams({ error: `oauth_${error}` }),
    );
  }

  if (!code || !state) {
    return redirectToHubspotSettings(
      request,
      new URLSearchParams({ error: "missing_params" }),
    );
  }

  const supabase = createAdminSupabaseClient();
  const { data: stateRow } = await supabase
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .eq("provider", "hubspot")
    .maybeSingle();

  if (!stateRow) {
    return redirectToHubspotSettings(
      request,
      new URLSearchParams({ error: "invalid_state" }),
    );
  }

  if (new Date(stateRow.expires_at) < new Date()) {
    await supabase.from("oauth_states").delete().eq("state", state);
    return redirectToHubspotSettings(
      request,
      new URLSearchParams({ error: "expired_state" }),
    );
  }

  await supabase.from("oauth_states").delete().eq("state", state);

  try {
    const tokens = await exchangeCodeForTokens(code);
    const metadata = await introspectAccessToken(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await saveHubspotIntegration(stateRow.org_id, {
      hubspot_portal_id:
        metadata.hubId ?? (tokens.hub_id ? String(tokens.hub_id) : "unknown"),
      hubspot_user_id: metadata.userId ?? undefined,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    });

    return redirectToHubspotSettings(
      request,
      new URLSearchParams({ connected: "true" }),
    );
  } catch (err) {
    // Generic code only: the raw message would land in browser history,
    // referrers and access logs via the redirect URL.
    console.error(
      "[hubspot/callback] token exchange failed:",
      err instanceof Error ? err.message : err,
    );
    return redirectToHubspotSettings(
      request,
      new URLSearchParams({ error: "token_exchange_failed" }),
    );
  }
}

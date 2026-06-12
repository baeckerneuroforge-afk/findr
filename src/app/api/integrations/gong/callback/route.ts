import { NextResponse } from "next/server";
import {
  exchangeCodeForGongTokens,
  saveGongIntegration,
} from "@/lib/gong/service";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

function redirectToGongSettings(request: Request, params: URLSearchParams) {
  return NextResponse.redirect(
    new URL(`/dashboard/integrations/gong?${params.toString()}`, request.url),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return redirectToGongSettings(
      request,
      new URLSearchParams({ error: `oauth_${error}` }),
    );
  }

  if (!code || !state) {
    return redirectToGongSettings(
      request,
      new URLSearchParams({ error: "missing_params" }),
    );
  }

  const supabase = createAdminSupabaseClient();
  const { data: stateRow } = await supabase
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .eq("provider", "gong")
    .maybeSingle();

  if (!stateRow) {
    return redirectToGongSettings(
      request,
      new URLSearchParams({ error: "invalid_state" }),
    );
  }

  if (new Date(stateRow.expires_at) < new Date()) {
    await supabase.from("oauth_states").delete().eq("state", state);
    return redirectToGongSettings(
      request,
      new URLSearchParams({ error: "expired_state" }),
    );
  }

  await supabase.from("oauth_states").delete().eq("state", state);

  try {
    const tokens = await exchangeCodeForGongTokens(code);
    await saveGongIntegration(stateRow.org_id, tokens);

    return redirectToGongSettings(
      request,
      new URLSearchParams({ connected: "true" }),
    );
  } catch (err) {
    // Generic code only: the raw message would land in browser history,
    // referrers and access logs via the redirect URL.
    console.error(
      "[gong/callback] token exchange failed:",
      err instanceof Error ? err.message : err,
    );
    return redirectToGongSettings(
      request,
      new URLSearchParams({ error: "token_exchange_failed" }),
    );
  }
}

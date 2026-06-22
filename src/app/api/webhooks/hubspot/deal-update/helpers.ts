import { maybeTriggerDealLost } from "@/lib/alerts/triggers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  analyzeAndPersistLossReason,
  findDealByHubspotId,
} from "@/lib/loss/service";

/**
 * Nicht-Route-Helfer des HubSpot-Webhooks, ausgelagert aus route.ts. Next.js
 * erlaubt in einer route.ts NUR Route-Handler + bekannte Config-Exports — ein
 * exportierter Helper bricht den `next build`-Route-Typecheck. Verhalten
 * unverändert; route.ts und die Tests importieren von hier (helpers).
 */

export async function processClosedLost(
  hubspotDealId: string,
): Promise<{ processed: boolean; reason?: string }> {
  const deal = await findDealByHubspotId(hubspotDealId);
  if (!deal) return { processed: false, reason: "deal_not_found" };
  if (deal.data_source === "mock") return { processed: false, reason: "mock_deal" };

  const supabase = createAdminSupabaseClient();
  await supabase
    .from("deals")
    .update({
      stage: "closed_lost",
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", deal.id)
    .eq("org_id", deal.org_id);

  const persisted = await analyzeAndPersistLossReason(deal.org_id, deal.id);
  if (!persisted) return { processed: false, reason: "loss_analysis_skipped" };

  await maybeTriggerDealLost({
    orgId: deal.org_id,
    dealId: deal.id,
    dealContext: {
      org_id: deal.org_id,
      deal_id: deal.id,
      deal_name: deal.name,
      deal_amount: deal.amount ?? undefined,
      deal_owner: deal.owner_name ?? "Unassigned",
      metadata: {
        primary_reason: persisted.analysis.primary_reason,
        confidence: persisted.analysis.confidence,
      },
    },
  });

  return { processed: true };
}

/**
 * Reconstruct the public URL HubSpot POSTed to. HubSpot's v3 signature is
 * computed over this exact URI; behind Vercel's proxy we rebuild it from the
 * forwarded headers (falling back to the Host header). If HubSpot ever returns
 * 401 in production, verify this reconstruction first.
 */
export function reconstructRequestUrl(request: Request): string {
  const url = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto") ?? url.protocol.replace(/:$/, "");
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    url.host;
  return `${proto}://${host}${url.pathname}${url.search}`;
}

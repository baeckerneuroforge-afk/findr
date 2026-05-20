import { NextResponse } from "next/server";
import { z } from "zod";
import { maybeTriggerDealLost } from "@/lib/alerts/triggers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  analyzeAndPersistLossReason,
  findDealByHubspotId,
} from "@/lib/loss/service";

const HubspotEventSchema = z.object({
  eventType: z.string().optional(),
  objectId: z.union([z.string(), z.number()]).transform(String),
  propertyName: z.string().optional(),
  propertyValue: z.string().optional(),
});

const HubspotWebhookSchema = z.union([
  z.object({ events: z.array(HubspotEventSchema) }),
  z.array(HubspotEventSchema),
]);

function getEvents(payload: z.infer<typeof HubspotWebhookSchema>) {
  return Array.isArray(payload) ? payload : payload.events;
}

function isClosedLostStage(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
  return normalized === "closedlost";
}

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

export async function POST(request: Request) {
  // TODO: verify Hubspot webhook signature before enabling public production use.
  const body = await request.json().catch(() => null);
  const parsed = HubspotWebhookSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const results: Array<{ objectId: string; processed: boolean; reason?: string }> =
    [];

  for (const event of getEvents(parsed.data)) {
    if (
      event.propertyName === "dealstage" &&
      isClosedLostStage(event.propertyValue)
    ) {
      const result = await processClosedLost(event.objectId);
      results.push({ objectId: event.objectId, ...result });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

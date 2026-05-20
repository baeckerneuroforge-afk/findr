import "server-only";

import { getCallsByDealId } from "@/lib/calls/service";
import { callsToDetectorCalls } from "@/lib/risk/adapters";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { extractLossReason, type LossAnalysis } from "./extractor";

export interface LossDealContext {
  id: string;
  org_id: string;
  name: string;
  amount: number | null;
  owner_name: string | null;
  company_name: string | null;
  data_source: string;
}

export interface PersistedLossAnalysis {
  analysis: LossAnalysis;
  deal: LossDealContext;
}

export async function analyzeAndPersistLossReason(
  orgId: string,
  dealId: string,
): Promise<PersistedLossAnalysis | null> {
  const supabase = createAdminSupabaseClient();
  const { data: deal, error } = await supabase
    .from("deals")
    .select("id, org_id, name, amount, owner_name, company_name, stage, data_source")
    .eq("org_id", orgId)
    .eq("id", dealId)
    .maybeSingle();

  if (error || !deal || deal.data_source === "mock") return null;

  const calls = await getCallsByDealId(orgId, dealId);
  const analysis = await extractLossReason({
    deal_id: deal.id,
    org_id: deal.org_id,
    calls: callsToDetectorCalls(calls),
    deal_stage: deal.stage ?? "closed_lost",
    deal_metadata: {
      name: deal.name,
      amount: deal.amount,
      ownerName: deal.owner_name,
      companyName: deal.company_name,
      dataSource: deal.data_source,
    },
  });

  const { error: upsertError } = await supabase.from("loss_reasons").upsert(
    {
      org_id: orgId,
      deal_id: dealId,
      primary_reason: analysis.primary_reason,
      secondary_reasons: analysis.secondary_reasons,
      confidence: analysis.confidence,
      evidence_quotes: analysis.evidence_quotes as unknown as Json,
      extraction_method: "heuristic",
      extracted_at: analysis.extracted_at,
    },
    { onConflict: "deal_id" },
  );

  if (upsertError) throw upsertError;

  return {
    analysis,
    deal,
  };
}

export async function findDealByHubspotId(
  hubspotDealId: string,
): Promise<LossDealContext | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("deals")
    .select("id, org_id, name, amount, owner_name, company_name, data_source")
    .eq("hubspot_deal_id", hubspotDealId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

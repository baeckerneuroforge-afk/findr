import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { LossReasonEvidence, LossReasonType } from "./extractor";

export interface LossReportData {
  period_start: string;
  period_end: string;
  total_lost_deals: number;
  total_lost_value: number;
  breakdown: Array<{
    reason: LossReasonType;
    count: number;
    value: number;
    percentage: number;
    sample_quotes: string[];
  }>;
  top_lost_companies: Array<{
    name: string;
    value: number;
    reason: LossReasonType;
  }>;
  trends: {
    vs_previous_period_count: number;
    vs_previous_period_value: number;
  };
}

export interface LossReportRow {
  primary_reason: LossReasonType;
  evidence_quotes: LossReasonEvidence[] | Json | null;
  deals: {
    name: string;
    amount: number | null;
    company_name: string | null;
  } | null;
}

function dateOnly(date: Date): string {
  return date.toISOString().split("T")[0] ?? date.toISOString();
}

function emptyReport(start: Date, end: Date): LossReportData {
  return {
    period_start: dateOnly(start),
    period_end: dateOnly(end),
    total_lost_deals: 0,
    total_lost_value: 0,
    breakdown: [],
    top_lost_companies: [],
    trends: { vs_previous_period_count: 0, vs_previous_period_value: 0 },
  };
}

function evidenceQuotes(value: LossReportRow["evidence_quotes"]): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      item && typeof item === "object" && "quote" in item
        ? String(item.quote)
        : null,
    )
    .filter((quote): quote is string => Boolean(quote));
}

export function buildLossReportData(
  losses: LossReportRow[],
  quarterStart: Date,
  quarterEnd: Date,
): LossReportData {
  if (losses.length === 0) return emptyReport(quarterStart, quarterEnd);

  const totalLostDeals = losses.length;
  const totalLostValue = losses.reduce(
    (sum, loss) => sum + (loss.deals?.amount ?? 0),
    0,
  );

  const byReason = new Map<
    LossReasonType,
    { count: number; value: number; quotes: string[] }
  >();

  for (const loss of losses) {
    const existing = byReason.get(loss.primary_reason) ?? {
      count: 0,
      value: 0,
      quotes: [],
    };
    existing.count += 1;
    existing.value += loss.deals?.amount ?? 0;

    for (const quote of evidenceQuotes(loss.evidence_quotes).slice(0, 2)) {
      if (existing.quotes.length < 3) existing.quotes.push(quote);
    }

    byReason.set(loss.primary_reason, existing);
  }

  const breakdown = Array.from(byReason.entries())
    .map(([reason, data]) => ({
      reason,
      count: data.count,
      value: data.value,
      percentage: (data.count / totalLostDeals) * 100,
      sample_quotes: data.quotes,
    }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  const top_lost_companies = [...losses]
    .sort((a, b) => (b.deals?.amount ?? 0) - (a.deals?.amount ?? 0))
    .slice(0, 5)
    .map((loss) => ({
      name: loss.deals?.company_name ?? loss.deals?.name ?? "Unknown",
      value: loss.deals?.amount ?? 0,
      reason: loss.primary_reason,
    }));

  return {
    period_start: dateOnly(quarterStart),
    period_end: dateOnly(quarterEnd),
    total_lost_deals: totalLostDeals,
    total_lost_value: totalLostValue,
    breakdown,
    top_lost_companies,
    trends: { vs_previous_period_count: 0, vs_previous_period_value: 0 },
  };
}

export async function generateQuarterlyReport(
  orgId: string,
  quarterStart: Date,
  quarterEnd: Date,
): Promise<LossReportData> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("loss_reasons")
    .select(
      `
      primary_reason,
      evidence_quotes,
      deals!inner(name, amount, company_name)
    `,
    )
    .eq("org_id", orgId)
    .gte("extracted_at", quarterStart.toISOString())
    .lte("extracted_at", quarterEnd.toISOString());

  if (error || !data) return emptyReport(quarterStart, quarterEnd);

  return buildLossReportData(
    data.map((row) => ({
      primary_reason: row.primary_reason as LossReasonType,
      evidence_quotes: row.evidence_quotes,
      deals: Array.isArray(row.deals) ? row.deals[0] ?? null : row.deals,
    })),
    quarterStart,
    quarterEnd,
  );
}

export async function cacheLossReport(
  orgId: string,
  report: LossReportData,
): Promise<void> {
  const supabase = createAdminSupabaseClient();
  await supabase.from("loss_reports").insert({
    org_id: orgId,
    period_start: report.period_start,
    period_end: report.period_end,
    total_lost_deals: report.total_lost_deals,
    total_lost_value: report.total_lost_value,
    breakdown: report.breakdown as unknown as Json,
  });
}

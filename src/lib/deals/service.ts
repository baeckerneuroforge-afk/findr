import "server-only";

import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import { MOCK_DEALS } from "./mock-data";
import type { Deal, DealStage } from "./types";

type DealRow = Database["public"]["Tables"]["deals"]["Row"];

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toDealStage(stage: string | null): DealStage {
  if (
    stage === "qualified" ||
    stage === "demo" ||
    stage === "proposal_sent" ||
    stage === "negotiation" ||
    stage === "verbal_commit" ||
    stage === "closed_won" ||
    stage === "closed_lost"
  ) {
    return stage;
  }

  return "qualified";
}

function toCurrency(currency: string | null | undefined): "USD" | "EUR" {
  return currency === "EUR" ? "EUR" : "USD";
}

function daysSince(date: string | null): number {
  if (!date) return 0;
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)),
  );
}

function fallbackCloseDate(row: DealRow): string {
  if (row.closed_at) return row.closed_at;
  const created = new Date(row.created_at);
  if (Number.isNaN(created.getTime())) return new Date().toISOString();
  created.setDate(created.getDate() + 30);
  return created.toISOString();
}

function getRawDataObject(rawData: Json | null): Record<string, Json | undefined> {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return {};
  }
  return rawData;
}

function getRawString(rawData: Record<string, Json | undefined>, key: string) {
  const value = rawData[key];
  return typeof value === "string" ? value : null;
}

function getRawNumber(rawData: Record<string, Json | undefined>, key: string) {
  const value = rawData[key];
  return typeof value === "number" ? value : null;
}

function getRawStringArray(
  rawData: Record<string, Json | undefined>,
  key: string,
) {
  const value = rawData[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function mapDbDealToDeal(row: DealRow): Deal {
  const lastActivity = row.last_activity_at ?? row.updated_at ?? row.created_at;
  const rawData = getRawDataObject(row.raw_data);
  const companyName =
    row.company_name ??
    getRawString(rawData, "companyName") ??
    "Unknown Company";
  const closeDate = getRawString(rawData, "closeDate") ?? fallbackCloseDate(row);

  return {
    id: row.id,
    name: row.name,
    companyName,
    amount: row.amount ?? 0,
    currency: toCurrency(row.currency),
    stage: toDealStage(row.stage),
    ownerName: row.owner_name ?? row.owner_email ?? "Unassigned",
    championName:
      getRawString(rawData, "championName") ??
      row.owner_name ??
      row.owner_email ??
      "Unknown",
    championTitle: getRawString(rawData, "championTitle") ?? "Unknown",
    daysSinceLastActivity: daysSince(lastActivity),
    callsCompleted: getRawNumber(rawData, "callsCompleted") ?? 0,
    emailsSent: getRawNumber(rawData, "emailsSent") ?? 0,
    stakeholdersCount: getRawNumber(rawData, "stakeholdersCount") ?? 0,
    competitorsMentioned: getRawStringArray(rawData, "competitorsMentioned"),
    closeDate,
    createdAt: row.created_at,
    dataSource: row.data_source,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    outcome: row.outcome,
    closedAt: row.closed_at,
  };
}

export async function getDealsByOrg(orgId: string): Promise<Deal[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("org_id", orgId)
    .eq("data_source", "hubspot")
    .order("last_activity_at", { ascending: false });

  if (!error && data && data.length > 0) {
    return data.map(mapDbDealToDeal);
  }

  const { data: seededDeals, error: seededError } = await supabase
    .from("deals")
    .select("*")
    .eq("org_id", orgId)
    .order("last_activity_at", { ascending: false });

  if (!seededError && seededDeals && seededDeals.length > 0) {
    return seededDeals.map(mapDbDealToDeal);
  }

  return MOCK_DEALS.map((deal) => ({ ...deal, dataSource: "mock" }));
}

export async function getDealById(
  orgId: string,
  dealId: string,
): Promise<Deal | null> {
  if (isUuid(dealId)) {
    const supabase = createAdminSupabaseClient();
    const { data } = await supabase
      .from("deals")
      .select("*")
      .eq("org_id", orgId)
      .eq("id", dealId)
      .maybeSingle();

    if (data) {
      return mapDbDealToDeal(data);
    }
  }

  const mockDeal = MOCK_DEALS.find((deal) => deal.id === dealId);
  return mockDeal ? { ...mockDeal, dataSource: "mock" } : null;
}

// ----------------------------------------------------------------------------
// Deal contact (post-loss interview prerequisite)
// ----------------------------------------------------------------------------

function emptyToUndefined(value: unknown) {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

/**
 * Contact fields a user can set on a deal. All optional; an empty/omitted value
 * clears the column (the editor always submits the full set).
 */
export const DealContactSchema = z.object({
  contactName: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(200).optional(),
  ),
  contactEmail: z.preprocess(
    emptyToUndefined,
    z.string().trim().email().max(200).optional(),
  ),
  contactPhone: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(80).optional(),
  ),
});

export type DealContactInput = z.infer<typeof DealContactSchema>;

/**
 * Set/replace a deal's contact details, scoped to the org. Returns the updated
 * Deal, or null if the id isn't a real (UUID) deal in this org — e.g. demo/mock
 * deals, which live in code rather than the DB.
 */
export async function updateDealContact(
  orgId: string,
  dealId: string,
  input: DealContactInput,
): Promise<Deal | null> {
  if (!isUuid(dealId)) return null;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("deals")
    .update({
      contact_name: input.contactName ?? null,
      contact_email: input.contactEmail ?? null,
      contact_phone: input.contactPhone ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", dealId)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return mapDbDealToDeal(data);
}

import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

const DEAL_STAGES = [
  "qualified",
  "demo",
  "proposal_sent",
  "negotiation",
  "verbal_commit",
  "closed_won",
  "closed_lost",
] as const;

const CURRENCIES = ["EUR", "USD"] as const;

type DealInsert = Database["public"]["Tables"]["deals"]["Insert"];
type CallInsert = Database["public"]["Tables"]["calls"]["Insert"];

export class ManualImportError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
    this.name = "ManualImportError";
  }
}

function emptyStringToUndefined(value: unknown) {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function optionalTrimmedString(max = 200) {
  return z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(1).max(max).optional(),
  );
}

export const ManualDealSchema = z.object({
  name: z.string().trim().min(1).max(200),
  companyName: optionalTrimmedString(),
  amount: z.coerce.number().min(0).max(100_000_000).default(0),
  currency: z.enum(CURRENCIES).default("EUR"),
  stage: z.enum(DEAL_STAGES).default("qualified"),
  ownerName: optionalTrimmedString(),
  championName: optionalTrimmedString(),
  contactName: optionalTrimmedString(),
  contactEmail: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().email().max(200).optional(),
  ),
  contactPhone: optionalTrimmedString(80),
  closeDate: z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .trim()
      .refine((value) => !Number.isNaN(new Date(value).getTime()), {
        message: "Invalid closeDate",
      })
      .optional(),
  ),
});

export const ManualCallSchema = z.object({
  dealId: z.string().uuid(),
  transcript: z.string().trim().min(1),
  callType: optionalTrimmedString(80),
  recordedAt: z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .trim()
      .refine((value) => !Number.isNaN(new Date(value).getTime()), {
        message: "Invalid recordedAt",
      })
      .optional(),
  ),
  durationSeconds: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().min(0).max(86_400).optional(),
  ),
});

export type ManualDealInput = z.infer<typeof ManualDealSchema>;
export type ManualCallInput = z.infer<typeof ManualCallSchema>;

function deriveOwnerEmail(ownerName?: string): string | null {
  if (!ownerName) return null;
  return ownerName.includes("@") ? ownerName : null;
}

function deriveOwnerName(ownerName?: string): string | null {
  if (!ownerName) return null;
  if (!ownerName.includes("@")) return ownerName;
  return ownerName.split("@")[0]?.replace(/[._-]+/g, " ") ?? ownerName;
}

function buildRawData(input: ManualDealInput, importedAt: string): Json {
  return {
    manualImport: true,
    importedAt,
    companyName: input.companyName,
    ownerName: input.ownerName,
    championName: input.championName,
    closeDate: input.closeDate,
    callsCompleted: 0,
    emailsSent: 0,
    stakeholdersCount: input.championName ? 1 : 0,
    competitorsMentioned: [],
  };
}

export function buildManualDealInsert(
  orgId: string,
  input: ManualDealInput,
  options: { externalId?: string; now?: string } = {},
): DealInsert {
  const now = options.now ?? new Date().toISOString();
  const externalId = options.externalId ?? `manual_${randomUUID()}`;
  const ownerName = deriveOwnerName(input.ownerName);

  return {
    org_id: orgId,
    external_id: externalId,
    source: "manual",
    data_source: "manual",
    name: input.name,
    company_name: input.companyName ?? null,
    amount: input.amount,
    currency: input.currency,
    stage: input.stage,
    owner_name: ownerName,
    owner_email: deriveOwnerEmail(input.ownerName),
    contact_name: input.contactName ?? null,
    contact_email: input.contactEmail ?? null,
    contact_phone: input.contactPhone ?? null,
    last_activity_at: now,
    raw_data: buildRawData(input, now),
    updated_at: now,
  };
}

export function buildManualCallInsert(
  orgId: string,
  input: ManualCallInput,
  options: { now?: string } = {},
): CallInsert {
  const now = options.now ?? new Date().toISOString();
  const recordedAt = input.recordedAt
    ? new Date(input.recordedAt).toISOString()
    : now;

  return {
    org_id: orgId,
    deal_id: input.dealId,
    source: "manual",
    call_type: input.callType ?? "manual_transcript",
    transcript: input.transcript,
    duration_seconds: input.durationSeconds ?? null,
    recorded_at: recordedAt,
    participants: {
      source: "manual",
      hint: "Raw pasted transcript. Speaker prefixes are parsed during analysis when present.",
    },
  };
}

export async function createManualDeal(
  orgId: string,
  input: ManualDealInput,
): Promise<{ id: string }> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("deals")
    .insert(buildManualDealInsert(orgId, input))
    .select("id")
    .single();

  if (error || !data) {
    throw new ManualImportError(error?.message ?? "Could not create deal", 500);
  }

  return { id: data.id };
}

export async function createManualCall(
  orgId: string,
  input: ManualCallInput,
): Promise<{ id: string }> {
  const supabase = createAdminSupabaseClient();
  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("id")
    .eq("org_id", orgId)
    .eq("id", input.dealId)
    .maybeSingle();

  if (dealError) {
    throw new ManualImportError(dealError.message, 500);
  }
  if (!deal) {
    throw new ManualImportError("Deal not found", 404);
  }

  const { data, error } = await supabase
    .from("calls")
    .insert(buildManualCallInsert(orgId, input))
    .select("id")
    .single();

  if (error || !data) {
    throw new ManualImportError(error?.message ?? "Could not create call", 500);
  }

  await supabase
    .from("deals")
    .update({
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", input.dealId);

  return { id: data.id };
}

export { DEAL_STAGES as MANUAL_IMPORT_DEAL_STAGES };

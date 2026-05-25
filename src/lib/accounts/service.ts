import "server-only";

import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { getDealById } from "@/lib/deals/service";
import { ACCOUNT_STATUSES, type Account, type AccountStatus } from "./types";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type AccountUpdate = Database["public"]["Tables"]["accounts"]["Update"];

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toCurrency(currency: string | null | undefined): "USD" | "EUR" {
  return currency === "USD" ? "USD" : "EUR";
}

function toStatus(status: string | null): AccountStatus {
  return status === "at_risk" || status === "churned" ? status : "active";
}

function mapRow(row: AccountRow): Account {
  return {
    id: row.id,
    companyName: row.company_name,
    sponsorName: row.sponsor_name,
    sponsorEmail: row.sponsor_email,
    sponsorPhone: row.sponsor_phone,
    mrr: row.mrr,
    currency: toCurrency(row.currency),
    renewalDate: row.renewal_date,
    status: toStatus(row.status),
    sourceDealId: row.source_deal_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ----------------------------------------------------------------------------
// Validation
// ----------------------------------------------------------------------------

/**
 * Optional free-text field: an empty/whitespace string becomes `null` (clear the
 * column) rather than being skipped, so the master-data editor — which always
 * submits the full set — can clear a field by sending it empty.
 */
function optionalText(max: number) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(max).nullable().optional(),
  );
}

function optionalEmail(max: number) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().email().max(max).nullable().optional(),
  );
}

/** MRR: accepts a number, a numeric string, "" / null (→ null), or omitted. */
const optionalMrr = z.preprocess((value) => {
  if (value === "" || value === null) return null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value; // non-numeric → let zod reject
  }
  return value;
}, z.number().nonnegative().max(1_000_000_000).nullable().optional());

/** Renewal date: ISO calendar date (YYYY-MM-DD) from a date input, or cleared. */
const optionalRenewalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date (YYYY-MM-DD)")
    .nullable()
    .optional(),
);

export const AccountCreateSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  sponsorName: optionalText(200),
  sponsorEmail: optionalEmail(200),
  sponsorPhone: optionalText(80),
  mrr: optionalMrr,
  currency: z.enum(["USD", "EUR"]).default("EUR"),
  renewalDate: optionalRenewalDate,
  status: z.enum(ACCOUNT_STATUSES).default("active"),
  notes: optionalText(5000),
});

export type AccountCreateInput = z.infer<typeof AccountCreateSchema>;

/**
 * Update schema: every field optional. A present field with `null`/"" clears the
 * column; an omitted field is left untouched. `companyName`, when present, must
 * still be non-empty.
 */
export const AccountUpdateSchema = z.object({
  companyName: z.string().trim().min(1).max(200).optional(),
  sponsorName: optionalText(200),
  sponsorEmail: optionalEmail(200),
  sponsorPhone: optionalText(80),
  mrr: optionalMrr,
  currency: z.enum(["USD", "EUR"]).optional(),
  renewalDate: optionalRenewalDate,
  status: z.enum(ACCOUNT_STATUSES).optional(),
  notes: optionalText(5000),
});

export type AccountUpdateInput = z.infer<typeof AccountUpdateSchema>;

// ----------------------------------------------------------------------------
// Reads
// ----------------------------------------------------------------------------

export async function getAccounts(orgId: string): Promise<Account[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(mapRow);
}

export async function getAccount(
  orgId: string,
  id: string,
): Promise<Account | null> {
  if (!isUuid(id)) return null;

  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("accounts")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  return data ? mapRow(data) : null;
}

/** The existing account created from a given deal, if any (one per deal). */
export async function getAccountBySourceDeal(
  orgId: string,
  dealId: string,
): Promise<Account | null> {
  if (!isUuid(dealId)) return null;

  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("accounts")
    .select("*")
    .eq("org_id", orgId)
    .eq("source_deal_id", dealId)
    .maybeSingle();

  return data ? mapRow(data) : null;
}

// ----------------------------------------------------------------------------
// Writes
// ----------------------------------------------------------------------------

export async function createAccount(
  orgId: string,
  input: AccountCreateInput,
): Promise<Account> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      org_id: orgId,
      company_name: input.companyName,
      sponsor_name: input.sponsorName ?? null,
      sponsor_email: input.sponsorEmail ?? null,
      sponsor_phone: input.sponsorPhone ?? null,
      mrr: input.mrr ?? null,
      currency: input.currency,
      renewal_date: input.renewalDate ?? null,
      status: input.status,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create account: ${error?.message ?? "no row returned"}`,
    );
  }
  return mapRow(data);
}

export async function updateAccount(
  orgId: string,
  id: string,
  input: AccountUpdateInput,
): Promise<Account | null> {
  if (!isUuid(id)) return null;

  // Only touch columns the caller actually sent (undefined = leave as-is). A
  // present null/"" value clears the column.
  const patch: AccountUpdate = { updated_at: new Date().toISOString() };
  if (input.companyName !== undefined) patch.company_name = input.companyName;
  if (input.sponsorName !== undefined) patch.sponsor_name = input.sponsorName;
  if (input.sponsorEmail !== undefined) patch.sponsor_email = input.sponsorEmail;
  if (input.sponsorPhone !== undefined) patch.sponsor_phone = input.sponsorPhone;
  if (input.mrr !== undefined) patch.mrr = input.mrr;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.renewalDate !== undefined) patch.renewal_date = input.renewalDate;
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("accounts")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}

/**
 * Create an account from a won deal: copies company + contact + amount and links
 * back via source_deal_id. Returns null if the deal isn't a real (UUID) deal in
 * this org or isn't marked won. Idempotent: if an account already exists for this
 * deal, the existing one is returned instead of a duplicate.
 */
export async function createAccountFromWonDeal(
  orgId: string,
  dealId: string,
): Promise<Account | null> {
  if (!isUuid(dealId)) return null;

  const deal = await getDealById(orgId, dealId);
  if (!deal || deal.outcome !== "won") return null;

  const existing = await getAccountBySourceDeal(orgId, dealId);
  if (existing) return existing;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      org_id: orgId,
      company_name: deal.companyName,
      sponsor_name: deal.contactName ?? null,
      sponsor_email: deal.contactEmail ?? null,
      sponsor_phone: deal.contactPhone ?? null,
      mrr: deal.amount ?? null,
      currency: deal.currency,
      status: "active",
      source_deal_id: dealId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create account from deal: ${error?.message ?? "no row returned"}`,
    );
  }
  return mapRow(data);
}

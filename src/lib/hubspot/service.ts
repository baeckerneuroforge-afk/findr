import "server-only";

import {
  HubspotCompanySchema,
  HubspotDealSchema,
  HubspotOwnerSchema,
  HubspotTokenIntrospectionSchema,
  HubspotTokenResponseSchema,
  type HubspotCompany,
  type HubspotDeal,
  type HubspotOwner,
} from "@/lib/schemas/hubspot";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

const HUBSPOT_API_BASE = "https://api.hubapi.com";
const HUBSPOT_OAUTH_BASE = "https://api.hubspot.com";
const HUBSPOT_TOKEN_URL = `${HUBSPOT_OAUTH_BASE}/oauth/v3/token`;

export interface HubspotIntegration {
  id: string;
  org_id: string;
  hubspot_portal_id: string;
  hubspot_user_id: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  last_synced_at: string | null;
  sync_status: "idle" | "syncing" | "failed";
  sync_error: string | null;
  enabled: boolean;
}

type HubspotIntegrationRow =
  Database["public"]["Tables"]["hubspot_integrations"]["Row"];

function toIntegration(row: HubspotIntegrationRow): HubspotIntegration {
  return {
    id: row.id,
    org_id: row.org_id,
    hubspot_portal_id: row.hubspot_portal_id,
    hubspot_user_id: row.hubspot_user_id,
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    token_expires_at: row.token_expires_at,
    last_synced_at: row.last_synced_at,
    sync_status: row.sync_status,
    sync_error: row.sync_error,
    enabled: row.enabled,
  };
}

function requireHubspotEnv() {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Hubspot OAuth env vars are missing. Set HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET, and HUBSPOT_REDIRECT_URI.",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export async function getHubspotIntegration(
  orgId: string,
): Promise<HubspotIntegration | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("hubspot_integrations")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !data) return null;
  return toIntegration(data);
}

export async function saveHubspotIntegration(
  orgId: string,
  data: {
    hubspot_portal_id: string;
    hubspot_user_id?: string;
    access_token: string;
    refresh_token: string;
    token_expires_at: string;
  },
) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("hubspot_integrations").upsert(
    {
      org_id: orgId,
      ...data,
      hubspot_user_id: data.hubspot_user_id ?? null,
      enabled: true,
      sync_status: "idle",
      sync_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );

  if (error) throw error;
}

export async function refreshAccessToken(
  integration: HubspotIntegration,
): Promise<HubspotIntegration> {
  const expiresAt = new Date(integration.token_expires_at);
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt > fiveMinFromNow) {
    return integration;
  }

  const { clientId, clientSecret } = requireHubspotEnv();
  const response = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: integration.refresh_token,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${text}`);
  }

  const json = await response.json();
  const parsed = HubspotTokenResponseSchema.parse(json);
  const newExpiresAt = new Date(Date.now() + parsed.expires_in * 1000);

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("hubspot_integrations")
    .update({
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      token_expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  if (error) throw error;

  return {
    ...integration,
    access_token: parsed.access_token,
    refresh_token: parsed.refresh_token,
    token_expires_at: newExpiresAt.toISOString(),
  };
}

export async function exchangeCodeForTokens(code: string) {
  const { clientId, clientSecret, redirectUri } = requireHubspotEnv();
  const response = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`token_exchange_failed: ${text.slice(0, 200)}`);
  }

  return HubspotTokenResponseSchema.parse(await response.json());
}

export async function introspectAccessToken(accessToken: string): Promise<{
  hubId: string | null;
  userId: string | null;
}> {
  const { clientId, clientSecret } = requireHubspotEnv();
  const response = await fetch(`${HUBSPOT_OAUTH_BASE}/oauth/v3/token/introspect`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token_type_hint: "access_token",
      access_token: accessToken,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    return { hubId: null, userId: null };
  }

  const parsed = HubspotTokenIntrospectionSchema.safeParse(await response.json());
  if (!parsed.success) return { hubId: null, userId: null };

  return {
    hubId: String(parsed.data.hub_id ?? parsed.data.hubId ?? "") || null,
    userId: String(parsed.data.user_id ?? parsed.data.userId ?? "") || null,
  };
}

async function hubspotFetch<T>(
  integration: HubspotIntegration,
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const refreshed = await refreshAccessToken(integration);

  const response = await fetch(`${HUBSPOT_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${refreshed.access_token}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Hubspot API ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchHubspotDeals(
  integration: HubspotIntegration,
): Promise<HubspotDeal[]> {
  const properties = [
    "dealname",
    "amount",
    "dealstage",
    "pipeline",
    "hubspot_owner_id",
    "closedate",
    "createdate",
    "hs_lastmodifieddate",
    "deal_currency_code",
  ].join(",");

  const allDeals: HubspotDeal[] = [];
  let after: string | undefined;
  let pageCount = 0;
  const maxPages = 10;

  do {
    const params = new URLSearchParams({
      limit: "100",
      properties,
      associations: "companies",
    });
    if (after) params.set("after", after);

    const response = await hubspotFetch<{
      results: unknown[];
      paging?: { next?: { after: string } };
    }>(integration, `/crm/v3/objects/deals?${params.toString()}`);

    for (const raw of response.results) {
      const parsed = HubspotDealSchema.safeParse(raw);
      if (parsed.success) {
        allDeals.push(parsed.data);
      }
    }

    after = response.paging?.next?.after;
    pageCount++;
  } while (after && pageCount < maxPages);

  return allDeals;
}

export async function fetchHubspotCompanies(
  integration: HubspotIntegration,
  companyIds: string[],
): Promise<Map<string, HubspotCompany>> {
  const result = new Map<string, HubspotCompany>();
  if (companyIds.length === 0) return result;

  for (let i = 0; i < companyIds.length; i += 100) {
    const chunk = companyIds.slice(i, i + 100);
    const response = await hubspotFetch<{ results: unknown[] }>(
      integration,
      "/crm/v3/objects/companies/batch/read",
      {
        method: "POST",
        body: JSON.stringify({
          inputs: chunk.map((id) => ({ id })),
          properties: ["name", "domain", "industry"],
        }),
      },
    );

    for (const raw of response.results) {
      const parsed = HubspotCompanySchema.safeParse(raw);
      if (parsed.success) {
        result.set(parsed.data.id, parsed.data);
      }
    }
  }

  return result;
}

export async function fetchHubspotOwners(
  integration: HubspotIntegration,
): Promise<Map<string, HubspotOwner>> {
  const result = new Map<string, HubspotOwner>();
  const response = await hubspotFetch<{ results: unknown[] }>(
    integration,
    "/crm/v3/owners?limit=100",
  );

  for (const raw of response.results) {
    const parsed = HubspotOwnerSchema.safeParse(raw);
    if (parsed.success) {
      result.set(parsed.data.id, parsed.data);
    }
  }

  return result;
}

export function normalizeHubspotStage(
  hubspotStage: string | null | undefined,
): string {
  if (!hubspotStage) return "qualified";
  const lower = hubspotStage.toLowerCase();

  if (lower.includes("closedwon") || lower.includes("closed_won")) {
    return "closed_won";
  }
  if (lower.includes("closedlost") || lower.includes("closed_lost")) {
    return "closed_lost";
  }
  if (lower.includes("contract") || lower.includes("verbal")) {
    return "verbal_commit";
  }
  if (lower.includes("proposal") || lower.includes("quote")) {
    return "proposal_sent";
  }
  if (lower.includes("negotiation")) return "negotiation";
  if (
    lower.includes("decision") ||
    lower.includes("demo") ||
    lower.includes("presentation")
  ) {
    return "demo";
  }

  return "qualified";
}

function normalizeCurrency(value: string | null | undefined): "USD" | "EUR" {
  const upper = value?.toUpperCase();
  return upper === "EUR" ? "EUR" : "USD";
}

function parseAmount(value: string | null | undefined): number | null {
  if (!value) return null;
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : null;
}

function ownerDisplayName(owner: HubspotOwner | null | undefined): string {
  if (!owner) return "Unassigned";
  return (
    `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() ||
    owner.email ||
    "Unknown"
  );
}

export async function syncHubspotDeals(orgId: string): Promise<{
  synced: number;
  errors: string[];
}> {
  const integration = await getHubspotIntegration(orgId);
  if (!integration) {
    throw new Error("No Hubspot integration configured");
  }

  const supabase = createAdminSupabaseClient();
  await supabase
    .from("hubspot_integrations")
    .update({
      sync_status: "syncing",
      sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  const result = { synced: 0, errors: [] as string[] };

  try {
    const deals = await fetchHubspotDeals(integration);
    const companyIds = new Set<string>();

    for (const deal of deals) {
      const companies = deal.associations?.companies?.results ?? [];
      for (const company of companies) companyIds.add(company.id);
    }

    const [companies, owners] = await Promise.all([
      fetchHubspotCompanies(integration, Array.from(companyIds)),
      fetchHubspotOwners(integration),
    ]);

    for (const deal of deals) {
      try {
        const companyId = deal.associations?.companies?.results?.[0]?.id;
        const company = companyId ? companies.get(companyId) : null;
        const ownerId = deal.properties.hubspot_owner_id;
        const owner = ownerId ? owners.get(ownerId) : null;
        const syncedAt = new Date().toISOString();
        const lastActivityAt = deal.properties.hs_lastmodifieddate
          ? new Date(deal.properties.hs_lastmodifieddate).toISOString()
          : syncedAt;
        const currency = normalizeCurrency(deal.properties.deal_currency_code);

        const { error: upsertError } = await supabase.from("deals").upsert(
          {
            org_id: orgId,
            external_id: deal.id,
            source: "hubspot",
            hubspot_deal_id: deal.id,
            name: deal.properties.dealname ?? `Deal #${deal.id}`,
            company_name: company?.properties.name ?? "Unknown Company",
            stage: normalizeHubspotStage(deal.properties.dealstage),
            amount: parseAmount(deal.properties.amount),
            currency,
            owner_name: ownerDisplayName(owner),
            owner_email: owner?.email ?? null,
            data_source: "hubspot",
            hubspot_last_synced_at: syncedAt,
            last_activity_at: lastActivityAt,
            closed_at: deal.properties.closedate
              ? new Date(deal.properties.closedate).toISOString()
              : null,
            raw_data: {
              hubspotDeal: deal,
              company,
              owner,
            } as Json,
          },
          { onConflict: "org_id,source,external_id" },
        );

        if (upsertError) {
          result.errors.push(`Deal ${deal.id}: ${upsertError.message}`);
        } else {
          result.synced++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        result.errors.push(`Deal ${deal.id}: ${msg}`);
      }
    }

    await supabase
      .from("hubspot_integrations")
      .update({
        sync_status: "idle",
        last_synced_at: new Date().toISOString(),
        sync_error:
          result.errors.length > 0 ? result.errors.slice(0, 5).join("; ") : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown sync error";
    await supabase
      .from("hubspot_integrations")
      .update({
        sync_status: "failed",
        sync_error: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);
    throw err;
  }
}

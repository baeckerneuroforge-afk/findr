import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import { getOrgName } from "@/lib/auth/org";
import { getOrgSettings } from "@/lib/settings/org-settings";
import { getAccount } from "@/lib/accounts/service";
import { getDealById } from "@/lib/deals/service";
import type {
  FeatureRequest,
  PainPoint,
  Theme,
} from "@/lib/schemas/product-discovery";
import { analyzeProductDiscovery } from "./classifier";

/**
 * Product Discovery service layer. Mirrors src/lib/risk/service.ts +
 * src/lib/accounts/health-service.ts: typed Supabase reads via the admin
 * client + explicit org_id filter, plus one analyze() entry-point that reads
 * a call's transcript, runs the classifier, and persists the result to
 * product_discovery_insights.
 *
 * Reads always take orgId explicitly (admin client bypasses RLS). The
 * write entry-point trusts the caller's org context — the route handler
 * verifies user-org-call membership before invoking; see
 * analyzeCallForProductDiscovery below.
 */

// ── Database type augmentation ──────────────────────────────────────────────
//
// product_discovery_insights is new in 20260609000000_product_discovery_
// insights.sql; src/types/database.ts has NOT been regenerated yet. Until it
// is, we widen the Database type locally so the typed Supabase client
// narrows .from("product_discovery_insights") cleanly. Once the user runs
// `supabase gen types` after applying the migration, this block (and the
// cast in createPDSupabase) can be removed and the function bodies will work
// against the regenerated Database type unchanged.

// Object-literal types (NOT interfaces) — the generated Database in
// src/types/database.ts uses inline literal types for every table, and
// supabase-js's `.insert(...)` overload narrowing only resolves cleanly
// against the same flavor of type. With interfaces the .insert() type
// degrades to `never[]` (TS2353 "org_id does not exist in type 'never[]'").
// Sentiment-Werte sind hier dupliziert (statt importiert) damit der DB-
// Layer-Type unabhängig vom Zod-Schema-Modul bleibt — sonst entsteht eine
// Cycle-Falle, wenn schemas/product-discovery jemals selbst aus service.ts
// importieren sollte. Tatsächlich gleiche Werte wie SENTIMENT_VALUES.
type SentimentValue = "positive" | "neutral" | "negative" | "mixed";
type RespondentSource = "ai" | "screening";

type ProductDiscoveryInsightRow = {
  id: string;
  org_id: string;
  source_call_id: string;
  deal_id: string | null;
  account_id: string | null;
  feature_requests: Json;
  pain_points: Json;
  themes: Json;
  summary: string | null;
  analysis_method: string;
  analyzed_at: string;
  created_at: string;
  // Spalten aus 20260616000000_product_discovery_respondent_context.sql.
  // Alle nullable außer respondent_source (NOT NULL DEFAULT 'ai').
  respondent_role: string | null;
  respondent_segment: string | null;
  sentiment: SentimentValue | null;
  plan_id: string | null;
  respondent_source: RespondentSource;
};

type ProductDiscoveryInsightInsert = {
  id?: string;
  org_id: string;
  source_call_id: string;
  deal_id?: string | null;
  account_id?: string | null;
  feature_requests?: Json;
  pain_points?: Json;
  themes?: Json;
  summary?: string | null;
  analysis_method?: string;
  analyzed_at?: string;
  created_at?: string;
  respondent_role?: string | null;
  respondent_segment?: string | null;
  sentiment?: SentimentValue | null;
  plan_id?: string | null;
  respondent_source?: RespondentSource;
};

type ProductDiscoveryInsightUpdate = {
  id?: string;
  org_id?: string;
  source_call_id?: string;
  deal_id?: string | null;
  account_id?: string | null;
  feature_requests?: Json;
  pain_points?: Json;
  themes?: Json;
  summary?: string | null;
  analysis_method?: string;
  analyzed_at?: string;
  created_at?: string;
  respondent_role?: string | null;
  respondent_segment?: string | null;
  sentiment?: SentimentValue | null;
  plan_id?: string | null;
  respondent_source?: RespondentSource;
};

// Explicit reconstruction instead of `Database & {...}` intersection: the
// supabase-js client's deep conditional generics get confused by intersected
// schema types and end up inferring Insert as `never[]` at the `.from(...)
// .insert({...})` call site. Spelling out every key of `public` keeps the
// shape simple and the generic narrowing reliable.
type DatabaseWithPD = {
  __InternalSupabase: Database["__InternalSupabase"];
  public: {
    Tables: Database["public"]["Tables"] & {
      product_discovery_insights: {
        Row: ProductDiscoveryInsightRow;
        Insert: ProductDiscoveryInsightInsert;
        Update: ProductDiscoveryInsightUpdate;
        Relationships: [];
      };
    };
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"];
    Enums: Database["public"]["Enums"];
    CompositeTypes: Database["public"]["CompositeTypes"];
  };
};

/**
 * Construct a SupabaseClient typed against the augmented DatabaseWithPD so
 * `.from("product_discovery_insights")` narrows correctly. We construct
 * fresh here instead of casting createAdminSupabaseClient()'s return value:
 * `as unknown as SupabaseClient<DatabaseWithPD>` survives the cast on paper
 * but the client's nested conditional generics don't pick up the augmented
 * Insert/Row types, and `.insert({...})` then resolves to `never[]` (TS2353
 * "org_id does not exist in type 'never[]'"). Once src/types/database.ts is
 * regenerated post-migration, both this helper and DatabaseWithPD can be
 * dropped and callers switch to createAdminSupabaseClient() directly.
 */
function createPDSupabase(): SupabaseClient<DatabaseWithPD> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin operations.",
    );
  }
  return createClient<DatabaseWithPD>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

// ── Public record shape ─────────────────────────────────────────────────────

/**
 * Typed view of a persisted insight. JSONB columns are narrowed to their
 * Zod-validated TypeScript shapes — the classifier validated them before
 * insert, so the runtime cast is safe (mirrors the pattern in risk/service.ts
 * for the `signals` JSONB column).
 */
export interface ProductDiscoveryInsightRecord {
  id: string;
  org_id: string;
  source_call_id: string;
  deal_id: string | null;
  account_id: string | null;
  feature_requests: FeatureRequest[];
  pain_points: PainPoint[];
  themes: Theme[];
  summary: string | null;
  /** "ai" = Claude classifier (always for current rows); "heuristic" reserved
   *  for a future fallback, mirroring the option on health/risk. */
  analysis_method: "ai" | "heuristic";
  analyzed_at: string;
  /** UI label resolved server-side: deal `name` (deal-side) or account
   *  `company_name` (account-side). null when the linked deal/account no
   *  longer exists or — for deal_id — is a legacy non-UUID seed string
   *  ("deal_001"…) without a matching deals row; the page renders a
   *  placeholder in that case. Only populated by getAllInsightsForOrg; the
   *  other read functions leave it null because their callers already know
   *  the parent's name from page context. */
  source_label: string | null;
  /** "deal" when the insight is attached to a deal_id, "account" otherwise.
   *  Derived from deal_id presence — XOR is enforced indirectly via the
   *  source call's calls.calls_single_parent_chk. */
  source_kind: "deal" | "account";
  // Spalten aus 20260616000000_product_discovery_respondent_context.sql.
  // Vom Stage-1-Classifier befüllt; gelesen von Stage-2-Synthese und vom
  // /dashboard/product-discovery-Rollup (sobald die UI diese Spalten
  // anzeigt). Legacy rows pre-Migration tragen null/null/null bzw.
  // respondent_source='ai' (Backfill via DEFAULT).
  respondent_role: string | null;
  respondent_segment: string | null;
  sentiment: "positive" | "neutral" | "negative" | "mixed" | null;
  /** Studien-Bezug — set bei Calls aus einem research_plans-Flow, null
   *  bei passiven Deal/Account-Calls. ON DELETE SET NULL: Insights
   *  überleben das Löschen ihres Plans. */
  plan_id: string | null;
  /** Wie die respondent_*-Felder befüllt wurden ('ai' vom Classifier,
   *  'screening' für späteren externen Recruiting-Pfad — heute immer
   *  'ai'). */
  respondent_source: "ai" | "screening";
}

function toRecord(
  row: ProductDiscoveryInsightRow,
  sourceLabel: string | null = null,
): ProductDiscoveryInsightRecord {
  return {
    id: row.id,
    org_id: row.org_id,
    source_call_id: row.source_call_id,
    deal_id: row.deal_id,
    account_id: row.account_id,
    feature_requests:
      (row.feature_requests as unknown as FeatureRequest[]) ?? [],
    pain_points: (row.pain_points as unknown as PainPoint[]) ?? [],
    themes: (row.themes as unknown as Theme[]) ?? [],
    summary: row.summary,
    analysis_method:
      (row.analysis_method as "ai" | "heuristic" | undefined) ?? "ai",
    analyzed_at: row.analyzed_at,
    source_label: sourceLabel,
    source_kind: row.deal_id ? "deal" : "account",
    respondent_role: row.respondent_role,
    respondent_segment: row.respondent_segment,
    sentiment: row.sentiment,
    plan_id: row.plan_id,
    respondent_source: row.respondent_source,
  };
}

/** UUID-form check used to filter `deal_id` values before querying `deals`
 *  by their `uuid` primary key. deal_id is `text` and holds a mix of real
 *  UUIDs and legacy seed strings ("deal_001" …, see 20260610*_product_
 *  discovery_deal_id_text.sql); only UUID-shaped ids can match. Non-UUID
 *  deal_ids resolve to a null source_label. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchDealNames(
  supabase: SupabaseClient<DatabaseWithPD>,
  orgId: string,
  dealIds: string[],
): Promise<Map<string, string>> {
  if (dealIds.length === 0) return new Map();
  const { data } = await supabase
    .from("deals")
    .select("id, name")
    .eq("org_id", orgId)
    .in("id", dealIds);
  if (!data) return new Map();
  return new Map(data.map((d) => [d.id, d.name]));
}

async function fetchAccountNames(
  supabase: SupabaseClient<DatabaseWithPD>,
  orgId: string,
  accountIds: string[],
): Promise<Map<string, string>> {
  if (accountIds.length === 0) return new Map();
  const { data } = await supabase
    .from("accounts")
    .select("id, company_name")
    .eq("org_id", orgId)
    .in("id", accountIds);
  if (!data) return new Map();
  return new Map(data.map((a) => [a.id, a.company_name]));
}

// ── Reads ───────────────────────────────────────────────────────────────────

/**
 * Latest insight per call across a batch of callIds. Returns a Map keyed by
 * source_call_id — callIds without a stored insight are absent. Mirrors
 * getLatestRiskScoresForDeals / getLatestHealthScoresForAccounts: ONE indexed
 * query + a JS dedup loop, so the deal/account detail pages can show
 * "hasInsights" per call without an N+1 fan-out.
 *
 * source_label and source_kind are left at their toRecord defaults (null /
 * derived). Detail-page callers already know the parent label from page
 * context; only the org-wide rollup pre-joins it (cf. getAllInsightsForOrg).
 */
export async function getLatestInsightsForCalls(
  orgId: string,
  callIds: string[],
): Promise<Map<string, ProductDiscoveryInsightRecord>> {
  if (callIds.length === 0) return new Map();

  const supabase = createPDSupabase();
  const { data, error } = await supabase
    .from("product_discovery_insights")
    .select("*")
    .eq("org_id", orgId)
    .in("source_call_id", callIds)
    .order("analyzed_at", { ascending: false });

  if (error || !data) return new Map();

  const latest = new Map<string, ProductDiscoveryInsightRecord>();
  for (const row of data) {
    if (!latest.has(row.source_call_id)) {
      latest.set(row.source_call_id, toRecord(row));
    }
  }
  return latest;
}

/** Most recent insight for a single call, or null if no extraction yet. */
export async function getLatestInsightsForCall(
  orgId: string,
  callId: string,
): Promise<ProductDiscoveryInsightRecord | null> {
  const supabase = createPDSupabase();
  const { data, error } = await supabase
    .from("product_discovery_insights")
    .select("*")
    .eq("org_id", orgId)
    .eq("source_call_id", callId)
    .order("analyzed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toRecord(data);
}

/** All insights across the calls of a single deal, newest first. A deal can
 *  have several calls; each call can be re-analysed, so this is naturally a
 *  list. */
export async function getInsightsForDeal(
  orgId: string,
  dealId: string,
): Promise<ProductDiscoveryInsightRecord[]> {
  const supabase = createPDSupabase();
  const { data, error } = await supabase
    .from("product_discovery_insights")
    .select("*")
    .eq("org_id", orgId)
    .eq("deal_id", dealId)
    .order("analyzed_at", { ascending: false });

  if (error || !data) return [];
  // Wrap to drop Array.map's index arg; toRecord's optional second param
  // is `string | null`, not `number`.
  return data.map((row) => toRecord(row));
}

/** All insights across the calls of a single account, newest first. */
export async function getInsightsForAccount(
  orgId: string,
  accountId: string,
): Promise<ProductDiscoveryInsightRecord[]> {
  const supabase = createPDSupabase();
  const { data, error } = await supabase
    .from("product_discovery_insights")
    .select("*")
    .eq("org_id", orgId)
    .eq("account_id", accountId)
    .order("analyzed_at", { ascending: false });

  if (error || !data) return [];
  // Wrap to drop Array.map's index arg; toRecord's optional second param
  // is `string | null`, not `number`.
  return data.map((row) => toRecord(row));
}

/**
 * All insights in an org, newest first, optionally bounded by an ISO `since`
 * cutoff. UI-ready: every record carries a resolved `source_label`
 * (deal.name or accounts.company_name) and `source_kind` ("deal" | "account")
 * so the rollup page can render the parent label and the link href without
 * a second hop.
 *
 * Resolution strategy: insights are fetched org-scoped, then deal-side and
 * account-side labels are looked up in TWO batched indexed queries
 * (`.in("id", …)`) and merged client-side. The conceptual equivalent is
 *
 *   LEFT JOIN deals    d ON d.id::text = pdi.deal_id AND d.org_id = pdi.org_id
 *   LEFT JOIN accounts a ON a.id      = pdi.account_id AND a.org_id = pdi.org_id
 *   SELECT COALESCE(d.name, a.company_name) AS source_label
 *
 * but supabase-js cannot express the uuid::text cast through its embedded-
 * select syntax (the deal_id FK was dropped in 20260610*; pdi.deal_id is
 * `text`, deals.id is `uuid`). Two `.in()` queries are also cheaper than the
 * cast-based join for typical org sizes since both lookups hit the primary
 * key index directly. Same pattern as getLatestHealthScoresForAccounts in
 * src/lib/accounts/health-service.ts.
 */
export async function getAllInsightsForOrg(
  orgId: string,
  since?: string,
): Promise<ProductDiscoveryInsightRecord[]> {
  const supabase = createPDSupabase();
  let query = supabase
    .from("product_discovery_insights")
    .select("*")
    .eq("org_id", orgId)
    .order("analyzed_at", { ascending: false });
  if (since) query = query.gte("analyzed_at", since);

  const { data, error } = await query;
  if (error || !data) return [];

  // Collect unique parent ids for the two label lookups. deal_id is filtered
  // to UUID-shaped values; legacy non-UUID strings have no matching deals
  // row and resolve to null source_label.
  const dealIds = [
    ...new Set(
      data
        .map((r) => r.deal_id)
        .filter((id): id is string => id !== null && UUID_RE.test(id)),
    ),
  ];
  const accountIds = [
    ...new Set(
      data
        .map((r) => r.account_id)
        .filter((id): id is string => id !== null),
    ),
  ];

  const [dealNames, accountNames] = await Promise.all([
    fetchDealNames(supabase, orgId, dealIds),
    fetchAccountNames(supabase, orgId, accountIds),
  ]);

  return data.map((row) => {
    const label =
      row.deal_id !== null
        ? (dealNames.get(row.deal_id) ?? null)
        : row.account_id !== null
          ? (accountNames.get(row.account_id) ?? null)
          : null;
    return toRecord(row, label);
  });
}

// ── Analysis (write) ────────────────────────────────────────────────────────

interface CallRecord {
  id: string;
  org_id: string;
  deal_id: string | null;
  account_id: string | null;
  transcript: string;
  recorded_at: string | null;
}

/**
 * Read a call by id WITHOUT an org filter, returning the row plus its
 * org_id so the caller can scope downstream work. Returns null when the
 * call does not exist or has an empty transcript — both are no-op
 * conditions for product discovery extraction (no point analysing nothing).
 *
 * Trust model: callers must have verified the user belongs to this call's
 * org BEFORE invoking analyzeCallForProductDiscovery. See the function's
 * docstring.
 */
async function loadCall(callId: string): Promise<CallRecord | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("calls")
    .select("id, org_id, deal_id, account_id, transcript, recorded_at")
    .eq("id", callId)
    .maybeSingle();
  if (error || !data) return null;
  if (!data.transcript || data.transcript.trim().length === 0) return null;
  return {
    id: data.id,
    org_id: data.org_id,
    deal_id: data.deal_id,
    account_id: data.account_id,
    transcript: data.transcript,
    recorded_at: data.recorded_at,
  };
}

/**
 * Resolve customer + org context for the classifier prompt. companyName +
 * sponsorName come from the account (post-sale) or the deal (pre-sale),
 * depending on which side the call is attached to (calls have an XOR
 * single-parent constraint). Org-level labels (orgName, productName) come
 * from org settings.
 *
 * Lookups are best-effort — if a side fails or is missing, the function
 * returns undefined and the classifier falls back to its no-context branch.
 * Mirrors health-service's resolution pattern.
 */
async function resolveAccountContext(
  call: CallRecord,
): Promise<
  | {
      companyName: string;
      sponsorName: string | null;
      productName: string | null;
      orgName: string | null;
    }
  | undefined
> {
  const [orgName, orgSettings] = await Promise.all([
    getOrgName(call.org_id).catch(() => null),
    getOrgSettings(call.org_id).catch(() => null),
  ]);

  let companyName: string | undefined;
  let sponsorName: string | null = null;

  if (call.account_id) {
    const account = await getAccount(call.org_id, call.account_id).catch(
      () => null,
    );
    if (account) {
      companyName = account.companyName;
      sponsorName = account.sponsorName;
    }
  } else if (call.deal_id) {
    const deal = await getDealById(call.org_id, call.deal_id).catch(() => null);
    if (deal) {
      companyName = deal.companyName;
      sponsorName = deal.contactName ?? null;
    }
  }

  if (!companyName) return undefined;
  return {
    companyName,
    sponsorName,
    productName: orgSettings?.productName?.trim() || null,
    orgName: orgName?.trim() || null,
  };
}

/**
 * Read a call's transcript, run the Product Discovery classifier, and
 * persist the result. Returns the persisted record, or null if the call
 * doesn't exist or has no transcript. Throws ProductDiscoveryUnavailableError
 * (from the classifier) when the model call fails after one retry.
 *
 * Trust model: the CALLER (route handler) is responsible for verifying that
 * the authenticated user has access to this call's organization before
 * invoking. This function does NOT take an `orgId` argument — it derives
 * org_id from the call row itself and persists the insight under that
 * org_id. This mirrors the per-call analyze pattern that a future
 * /api/calls/[id]/product-discovery route would use after the Clerk +
 * org-membership check.
 *
 * `planId` (optional, second-arg) — set when the call belongs to a
 * research_plans-Studie (Research-Flow via transcript-service.ts). Wird in
 * product_discovery_insights.plan_id geschrieben und stellt damit den
 * Studien-Bezug her, den Stage 2 (cross-call Synthese) zum Filtern nutzt.
 * Bei passiven Deal/Account-Calls (Standard-Path) NULL — `null`/`undefined`
 * werden beide als NULL persistiert.
 */
export async function analyzeCallForProductDiscovery(
  callId: string,
  options?: { planId?: string | null },
): Promise<ProductDiscoveryInsightRecord | null> {
  const call = await loadCall(callId);
  if (!call) return null;

  const account = await resolveAccountContext(call);

  const result = await analyzeProductDiscovery({
    transcript: call.transcript,
    account,
    recordedAt: call.recorded_at,
  });

  const supabase = createPDSupabase();
  const { data, error } = await supabase
    .from("product_discovery_insights")
    .insert({
      org_id: call.org_id,
      source_call_id: call.id,
      deal_id: call.deal_id,
      account_id: call.account_id,
      feature_requests: result.featureRequests as unknown as Json,
      pain_points: result.painPoints as unknown as Json,
      themes: result.themes as unknown as Json,
      summary: result.summary,
      analysis_method: "ai",
      analyzed_at: new Date().toISOString(),
      // Stage-1-Respondent-Kontext aus dem Classifier — Schema hält Felder
      // nullable, der Classifier liefert null wenn das Transkript nichts
      // hergibt (Posture: nicht raten). respondent_source ist immer 'ai'
      // auf diesem Pfad; der reservierte 'screening'-Wert kommt erst mit
      // einem externen Recruiting-Pool, der per Definition nicht durch
      // diesen analyze-Call läuft.
      respondent_role: result.respondentRole,
      respondent_segment: result.respondentSegment,
      sentiment: result.sentiment,
      respondent_source: "ai",
      // Studien-Bezug — durchgereicht vom Caller. Null bei passiven Calls.
      plan_id: options?.planId ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to persist product discovery insight: ${error?.message ?? "no row returned"}`,
    );
  }

  return toRecord(data);
}

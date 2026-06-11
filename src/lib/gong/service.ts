import "server-only";

import {
  GongCallSchema,
  GongTokenResponseSchema,
  GongTranscriptSchema,
  GongUserSchema,
  type GongTranscriptSegment,
  type GongUser,
} from "@/lib/schemas/gong";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-cipher";
import { getDealsByOrg } from "@/lib/deals/service";
import { mapGongCallToDeal } from "./deal-mapping";
import type { Database, Json } from "@/types/database";

const GONG_AUTH_URL = "https://app.gong.io/oauth2/authorize";
const GONG_TOKEN_URL = "https://app.gong.io/oauth2/generate-customer-token";
const DEFAULT_SYNC_LOOKBACK_DAYS = 30;

export const GONG_SCOPES = [
  "api:calls:read:basic",
  "api:calls:read:extensive",
  "api:calls:read:transcript",
  "api:users:read",
] as const;

type GongIntegrationRow =
  Database["public"]["Tables"]["gong_integrations"]["Row"];

export interface GongIntegration {
  id: string;
  org_id: string;
  gong_company_id: string | null;
  api_base_url: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  scope: string | null;
  last_synced_at: string | null;
  sync_status: "idle" | "syncing" | "failed";
  sync_error: string | null;
  enabled: boolean;
}

export interface NormalizedGongParticipant {
  id: string | null;
  name: string | null;
  email: string | null;
  title: string | null;
  role: "sales_rep" | "buyer" | "buyer_team" | "champion";
}

export interface NormalizedGongCall {
  id: string;
  title: string;
  startedAt: string | null;
  durationSeconds: number | null;
  url: string | null;
  workspaceId: string | null;
  primaryUserId: string | null;
  participants: NormalizedGongParticipant[];
  raw: Json;
}

export interface NormalizedGongSegment {
  speakerId: string | null;
  speakerName: string | null;
  speakerEmail: string | null;
  speakerRole: string | null;
  startSeconds: number;
  endSeconds: number;
  text: string;
  raw: Json;
}

export class GongConfigurationError extends Error {
  constructor() {
    super(
      "Gong integration not configured. Set GONG_CLIENT_ID, GONG_CLIENT_SECRET, and GONG_REDIRECT_URI.",
    );
    this.name = "GongConfigurationError";
  }
}

export class GongAuthError extends Error {
  constructor(message = "Gong connection lost. Please reconnect.") {
    super(message);
    this.name = "GongAuthError";
  }
}

function toIntegration(row: GongIntegrationRow): GongIntegration {
  return {
    id: row.id,
    org_id: row.org_id,
    gong_company_id: row.gong_company_id,
    api_base_url: row.api_base_url,
    access_token: decryptSecret(row.access_token),
    refresh_token: decryptSecret(row.refresh_token),
    token_expires_at: row.token_expires_at,
    scope: row.scope,
    last_synced_at: row.last_synced_at,
    sync_status: row.sync_status,
    sync_error: row.sync_error,
    enabled: row.enabled,
  };
}

export function isGongConfigured(): boolean {
  return Boolean(
    process.env.GONG_CLIENT_ID &&
      process.env.GONG_CLIENT_SECRET &&
      process.env.GONG_REDIRECT_URI,
  );
}

function requireGongEnv() {
  const clientId = process.env.GONG_CLIENT_ID;
  const clientSecret = process.env.GONG_CLIENT_SECRET;
  const redirectUri = process.env.GONG_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new GongConfigurationError();
  }

  return { clientId, clientSecret, redirectUri };
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function toIso(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function arrayFromResponse(value: unknown, keys: string[]): unknown[] {
  const record = asRecord(value);
  for (const key of keys) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function cursorFromResponse(value: unknown): string | undefined {
  const record = asRecord(value);
  const cursor = record.cursor ?? asRecord(record.records).cursor;
  return typeof cursor === "string" && cursor ? cursor : undefined;
}

function normalizeParticipant(raw: unknown): NormalizedGongParticipant {
  const record = asRecord(raw);
  const user = asRecord(record.user);
  const email = firstString(
    record.emailAddress,
    record.email,
    user.emailAddress,
    user.email,
  );
  const composedName = [
    firstString(record.firstName, user.firstName),
    firstString(record.lastName, user.lastName),
  ]
    .filter(Boolean)
    .join(" ");
  const name = (firstString(record.name, user.name) ?? composedName) || null;
  const speakerRole = firstString(record.affiliation, record.role, record.type);
  const role =
    speakerRole?.toLowerCase().includes("internal") ||
    speakerRole?.toLowerCase().includes("team")
      ? "sales_rep"
      : "buyer";

  return {
    id: firstString(record.id, record.userId, user.id),
    name,
    email,
    title: firstString(record.title, user.title),
    role,
  };
}

function normalizeCall(raw: unknown): NormalizedGongCall | null {
  const parsed = GongCallSchema.safeParse(raw);
  if (!parsed.success) return null;

  const record = asRecord(raw);
  const meta = asRecord(record.metaData);
  const content = asRecord(record.content);
  const context = asRecord(record.context);
  const parties = Array.isArray(record.parties)
    ? record.parties
    : Array.isArray(record.participants)
      ? record.participants
      : [];
  const id = firstString(record.callId, record.id);
  if (!id) return null;

  return {
    id,
    title:
      firstString(record.title, content.title, meta.title, context.title) ??
      `Gong call ${id}`,
    startedAt: toIso(
      firstString(record.started, record.startedAt, record.scheduled, meta.started),
    ),
    durationSeconds: firstNumber(
      record.durationSeconds,
      record.duration,
      meta.duration,
    ),
    url: firstString(record.url, record.callUrl, meta.url),
    workspaceId: firstString(record.workspaceId, meta.workspaceId),
    primaryUserId: firstString(record.primaryUserId, meta.primaryUserId),
    participants: parties.map(normalizeParticipant),
    raw: raw as Json,
  };
}

function normalizeUser(raw: unknown): GongUser | null {
  const parsed = GongUserSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function displayName(user: GongUser): string | null {
  const first = typeof user.firstName === "string" ? user.firstName : "";
  const last = typeof user.lastName === "string" ? user.lastName : "";
  const composedName = `${first} ${last}`.trim();
  return (user.name ?? composedName) || null;
}

function userEmail(user: GongUser): string | null {
  return user.emailAddress ?? user.email ?? null;
}

function normalizeTranscriptSegments(
  transcript: unknown,
): NormalizedGongSegment[] {
  const parsed = GongTranscriptSchema.safeParse(transcript);
  if (!parsed.success) return [];

  const segments = parsed.data.transcript ?? parsed.data.segments ?? [];
  const normalized: NormalizedGongSegment[] = [];

  for (const segment of segments) {
    const sentences = segment.sentences ?? [];
    if (sentences.length === 0 && segment.text) {
      normalized.push({
        speakerId: firstString(segment.speakerId),
        speakerName: segment.speakerName ?? null,
        speakerEmail: segment.speakerEmail ?? null,
        speakerRole: segment.topic ?? null,
        startSeconds: firstNumber(segment.start) ?? 0,
        endSeconds: firstNumber(segment.end) ?? 0,
        text: segment.text,
        raw: segment as unknown as Json,
      });
      continue;
    }

    for (const sentence of sentences) {
      normalized.push({
        speakerId: firstString(segment.speakerId),
        speakerName: segment.speakerName ?? null,
        speakerEmail: segment.speakerEmail ?? null,
        speakerRole: segment.topic ?? null,
        startSeconds:
          firstNumber(
            sentence.startTimeSeconds,
            sentence.startTime,
            sentence.start,
          ) ?? 0,
        endSeconds:
          firstNumber(sentence.endTimeSeconds, sentence.endTime, sentence.end) ??
          0,
        text: sentence.text,
        raw: { segment, sentence } as unknown as Json,
      });
    }
  }

  return normalized;
}

export function buildGongAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = requireGongEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: GONG_SCOPES.join(" "),
    redirect_uri: redirectUri,
    state,
  });

  return `${GONG_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForGongTokens(code: string) {
  const { clientId, clientSecret, redirectUri } = requireGongEnv();
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  const response = await fetch(`${GONG_TOKEN_URL}?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`gong_token_exchange_failed: ${text.slice(0, 200)}`);
  }

  return GongTokenResponseSchema.parse(await response.json());
}

export async function getGongIntegration(
  orgId: string,
): Promise<GongIntegration | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("gong_integrations")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !data) return null;
  return toIntegration(data);
}

export async function saveGongIntegration(
  orgId: string,
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
    api_base_url_for_customer: string;
  },
) {
  const supabase = createAdminSupabaseClient();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const companyId = new URL(tokens.api_base_url_for_customer).hostname.split(".")[0];

  const { error } = await supabase.from("gong_integrations").upsert(
    {
      org_id: orgId,
      gong_company_id: companyId,
      api_base_url: tokens.api_base_url_for_customer.replace(/\/$/, ""),
      access_token: encryptSecret(tokens.access_token),
      refresh_token: encryptSecret(tokens.refresh_token),
      token_expires_at: expiresAt.toISOString(),
      scope: tokens.scope ?? null,
      enabled: true,
      sync_status: "idle",
      sync_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );

  if (error) throw error;
}

export async function refreshGongAccessToken(
  integration: GongIntegration,
): Promise<GongIntegration> {
  const expiresAt = new Date(integration.token_expires_at);
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt > fiveMinFromNow) return integration;

  const { clientId, clientSecret } = requireGongEnv();
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: integration.refresh_token,
  });

  const response = await fetch(`${GONG_TOKEN_URL}?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new GongAuthError();
  }

  const tokens = GongTokenResponseSchema.parse(await response.json());
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("gong_integrations")
    .update({
      access_token: encryptSecret(tokens.access_token),
      refresh_token: encryptSecret(tokens.refresh_token),
      token_expires_at: newExpiresAt.toISOString(),
      api_base_url: tokens.api_base_url_for_customer.replace(/\/$/, ""),
      scope: tokens.scope ?? integration.scope,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  if (error) throw error;

  return {
    ...integration,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: newExpiresAt.toISOString(),
    api_base_url: tokens.api_base_url_for_customer.replace(/\/$/, ""),
    scope: tokens.scope ?? integration.scope,
  };
}

async function gongFetch<T>(
  integration: GongIntegration,
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const refreshed = await refreshGongAccessToken(integration);
  const response = await fetch(`${refreshed.api_base_url}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${refreshed.access_token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (response.status === 401) throw new GongAuthError();
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gong API ${response.status}: ${text.slice(0, 500)}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchGongUsers(
  integration: GongIntegration,
): Promise<GongUser[]> {
  const users: GongUser[] = [];
  let cursor: string | undefined;
  let pageCount = 0;

  do {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    const response = await gongFetch<unknown>(
      integration,
      `/v2/users${params.size ? `?${params.toString()}` : ""}`,
    );

    for (const raw of arrayFromResponse(response, ["users", "records"])) {
      const user = normalizeUser(raw);
      if (user) users.push(user);
    }

    cursor = cursorFromResponse(response);
    pageCount++;
  } while (cursor && pageCount < 10);

  return users;
}

export async function fetchGongCalls(
  integration: GongIntegration,
  fromDateTime: string,
  toDateTime: string,
): Promise<NormalizedGongCall[]> {
  const calls: NormalizedGongCall[] = [];
  let cursor: string | undefined;
  let pageCount = 0;

  do {
    const params = new URLSearchParams({
      fromDateTime,
      toDateTime,
    });
    if (cursor) params.set("cursor", cursor);

    const response = await gongFetch<unknown>(
      integration,
      `/v2/calls?${params.toString()}`,
    );
    for (const raw of arrayFromResponse(response, ["calls", "records"])) {
      const call = normalizeCall(raw);
      if (call) calls.push(call);
    }

    cursor = cursorFromResponse(response);
    pageCount++;
  } while (cursor && pageCount < 10);

  return calls;
}

export async function fetchGongCallTranscripts(
  integration: GongIntegration,
  callIds: string[],
): Promise<Map<string, NormalizedGongSegment[]>> {
  const result = new Map<string, NormalizedGongSegment[]>();
  if (callIds.length === 0) return result;

  for (let i = 0; i < callIds.length; i += 100) {
    const chunk = callIds.slice(i, i + 100);
    const response = await gongFetch<unknown>(
      integration,
      "/v2/calls/transcript",
      {
        method: "POST",
        body: JSON.stringify({
          filter: {
            callIds: chunk,
          },
        }),
      },
    );

    for (const raw of arrayFromResponse(response, [
      "callTranscripts",
      "transcripts",
      "records",
    ])) {
      const parsed = GongTranscriptSchema.safeParse(raw);
      if (!parsed.success) continue;
      result.set(parsed.data.callId, normalizeTranscriptSegments(raw));
    }
  }

  return result;
}

async function cacheGongUsers(orgId: string, users: GongUser[]) {
  if (users.length === 0) return;
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const rows = users.map((user) => ({
    org_id: orgId,
    gong_user_id: user.id,
    email: userEmail(user),
    name: displayName(user),
    title: user.title ?? null,
    raw_data: user as unknown as Json,
    last_synced_at: now,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("gong_users")
    .upsert(rows, { onConflict: "org_id,gong_user_id" });

  if (error) throw error;
}

function segmentTranscript(segments: NormalizedGongSegment[]): string {
  return segments
    .map((segment) => `${segment.speakerName ?? "Speaker"}: ${segment.text}`)
    .join("\n\n");
}

function transcriptSummary(call: NormalizedGongCall, segmentCount: number): string {
  return `${call.title}. ${segmentCount} transcript segment${
    segmentCount === 1 ? "" : "s"
  } synced from Gong.`;
}

async function replaceCallSegments(
  orgId: string,
  callId: string,
  gongCallId: string,
  segments: NormalizedGongSegment[],
) {
  const supabase = createAdminSupabaseClient();
  await supabase.from("call_segments").delete().eq("call_id", callId);
  await supabase.from("transcript_segments").delete().eq("call_id", callId);
  await supabase.from("call_speakers").delete().eq("call_id", callId);

  const speakerKeySet = new Set(
    segments.map(
      (segment) =>
        segment.speakerId ??
        segment.speakerEmail ??
        segment.speakerName ??
        "unknown",
    ),
  );
  const speakerKeys = Array.from(speakerKeySet);
  const speakerIdByKey = new Map<string, string>();

  for (const key of speakerKeys) {
    const firstSegment = segments.find(
      (segment) =>
        (segment.speakerId ??
          segment.speakerEmail ??
          segment.speakerName ??
          "unknown") === key,
    );
    const { data, error } = await supabase
      .from("call_speakers")
      .insert({
        call_id: callId,
        name: firstSegment?.speakerName ?? firstSegment?.speakerEmail ?? "Unknown",
        role: firstSegment?.speakerRole ?? "Participant",
        organization: null,
        speaker_type: firstSegment?.speakerRole === "sales_rep" ? "sales_rep" : "buyer",
      })
      .select("id")
      .single();

    if (error || !data) throw error ?? new Error("Failed to create speaker");
    speakerIdByKey.set(key, data.id);
  }

  if (segments.length === 0) return;

  const callSegmentRows = segments.map((segment) => ({
    org_id: orgId,
    call_id: callId,
    gong_call_id: gongCallId,
    speaker_id: segment.speakerId,
    speaker_name: segment.speakerName,
    speaker_email: segment.speakerEmail,
    speaker_role: segment.speakerRole,
    start_seconds: segment.startSeconds,
    end_seconds: segment.endSeconds,
    text: segment.text,
    raw_data: segment.raw,
  }));

  const { error: callSegmentsError } = await supabase
    .from("call_segments")
    .insert(callSegmentRows);
  if (callSegmentsError) throw callSegmentsError;

  const transcriptRows = segments
    .map((segment) => {
      const key =
        segment.speakerId ?? segment.speakerEmail ?? segment.speakerName ?? "unknown";
      const speakerId = speakerIdByKey.get(key);
      if (!speakerId) return null;
      return {
        call_id: callId,
        speaker_id: speakerId,
        start_seconds: segment.startSeconds,
        end_seconds: segment.endSeconds,
        text: segment.text,
        signals: [],
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (transcriptRows.length > 0) {
    const { error } = await supabase
      .from("transcript_segments")
      .insert(transcriptRows);
    if (error) throw error;
  }
}

export async function syncGongCalls(orgId: string): Promise<{
  syncedCalls: number;
  syncedSegments: number;
  unmatchedCalls: number;
  errors: string[];
}> {
  const integration = await getGongIntegration(orgId);
  if (!integration) throw new Error("No Gong integration configured");

  const supabase = createAdminSupabaseClient();
  await supabase
    .from("gong_integrations")
    .update({
      sync_status: "syncing",
      sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  const result = {
    syncedCalls: 0,
    syncedSegments: 0,
    unmatchedCalls: 0,
    errors: [] as string[],
  };

  try {
    const from = new Date(
      integration.last_synced_at
        ? new Date(integration.last_synced_at).getTime() - 2 * 24 * 60 * 60 * 1000
        : Date.now() - DEFAULT_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const to = new Date().toISOString();

    const [users, calls] = await Promise.all([
      fetchGongUsers(integration),
      fetchGongCalls(integration, from, to),
    ]);
    await cacheGongUsers(orgId, users);

    const transcripts = await fetchGongCallTranscripts(
      integration,
      calls.map((call) => call.id),
    );
    const deals = await getDealsByOrg(orgId);

    for (const call of calls) {
      try {
        const segments = transcripts.get(call.id) ?? [];
        const mapping = mapGongCallToDeal(call, deals);
        if (!mapping.dealId) result.unmatchedCalls++;

        const { data: callRecord, error: callError } = await supabase
          .from("calls")
          .upsert(
            {
              org_id: orgId,
              deal_id: mapping.dealId,
              source: "gong",
              gong_call_id: call.id,
              gong_url: call.url,
              gong_workspace_id: call.workspaceId,
              gong_primary_user_id: call.primaryUserId,
              deal_mapping_method: mapping.method,
              deal_mapping_confidence: mapping.confidence,
              transcript: segmentTranscript(segments),
              transcript_summary: transcriptSummary(call, segments.length),
              duration_seconds: call.durationSeconds,
              recorded_at: call.startedAt,
              participants: call.participants as unknown as Json,
              call_type: "gong",
            },
            { onConflict: "org_id,gong_call_id" },
          )
          .select("id")
          .single();

        if (callError || !callRecord) {
          result.errors.push(
            `Call ${call.id}: ${callError?.message ?? "insert failed"}`,
          );
          continue;
        }

        await replaceCallSegments(orgId, callRecord.id, call.id, segments);
        result.syncedCalls++;
        result.syncedSegments += segments.length;
      } catch (err) {
        result.errors.push(
          `Call ${call.id}: ${err instanceof Error ? err.message : "unknown"}`,
        );
      }
    }

    await supabase
      .from("gong_integrations")
      .update({
        sync_status: "idle",
        sync_error:
          result.errors.length > 0 ? result.errors.slice(0, 5).join("; ") : null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown Gong sync error";
    await supabase
      .from("gong_integrations")
      .update({
        sync_status: "failed",
        sync_error: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);
    throw err;
  }
}

export async function disconnectGongIntegration(orgId: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("gong_integrations")
    .delete()
    .eq("org_id", orgId);

  if (error) throw error;
}

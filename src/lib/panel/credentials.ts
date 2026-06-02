import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

import {
  createResearchSupabase,
  type PanelProviderCredentialRow,
} from "@/lib/research/db";
import type { PanelProviderKey } from "./providers";

export const PANEL_CREDENTIALS_ENCRYPTION_KEY_ENV =
  "PANEL_CREDENTIALS_ENCRYPTION_KEY";
export const PANEL_CREDENTIALS_ENCRYPTION_KEY_ID_ENV =
  "PANEL_CREDENTIALS_ENCRYPTION_KEY_ID";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

export interface PanelCredentialSummary {
  provider: PanelProviderKey;
  status: "connected" | "invalid" | "unknown";
  tokenHint: string | null;
  providerUserEmail: string | null;
  lastValidatedAt: string | null;
  validationError: string | null;
}

interface EncryptedSecret {
  encryptedApiToken: string;
  tokenIv: string;
  tokenAuthTag: string;
  encryptionKeyId: string | null;
}

function readEncryptionKey(): Buffer {
  const raw = process.env[PANEL_CREDENTIALS_ENCRYPTION_KEY_ENV];
  if (!raw) {
    throw new Error(
      `${PANEL_CREDENTIALS_ENCRYPTION_KEY_ENV} is not set. Required for panel provider credentials.`,
    );
  }

  const trimmed = raw.trim();
  const base64 = Buffer.from(trimmed, "base64");
  if (base64.length === KEY_BYTES) return base64;

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  const utf8 = Buffer.from(trimmed, "utf8");
  if (utf8.length === KEY_BYTES) return utf8;

  throw new Error(
    `${PANEL_CREDENTIALS_ENCRYPTION_KEY_ENV} must decode to exactly 32 bytes (base64, hex, or 32-byte utf8).`,
  );
}

function encryptSecret(plaintext: string): EncryptedSecret {
  const key = readEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedApiToken: ciphertext.toString("base64"),
    tokenIv: iv.toString("base64"),
    tokenAuthTag: authTag.toString("base64"),
    encryptionKeyId:
      process.env[PANEL_CREDENTIALS_ENCRYPTION_KEY_ID_ENV]?.trim() || null,
  };
}

function decryptSecret(row: PanelProviderCredentialRow): string {
  const key = readEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(row.token_iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(row.token_auth_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_api_token, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function tokenHint(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 4) return "set";
  return `...${trimmed.slice(-4)}`;
}

function toSummary(row: PanelProviderCredentialRow): PanelCredentialSummary {
  return {
    provider: row.provider,
    status: row.status,
    tokenHint: row.token_hint,
    providerUserEmail: row.provider_user_email,
    lastValidatedAt: row.last_validated_at,
    validationError: row.validation_error,
  };
}

export async function getPanelCredentialSummary(
  orgId: string,
  provider: PanelProviderKey,
): Promise<PanelCredentialSummary | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("panel_provider_credentials")
    .select("*")
    .eq("org_id", orgId)
    .eq("provider", provider)
    .maybeSingle();
  if (error || !data) return null;
  return toSummary(data);
}

export async function getPanelCredentialToken(
  orgId: string,
  provider: PanelProviderKey,
): Promise<string | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("panel_provider_credentials")
    .select("*")
    .eq("org_id", orgId)
    .eq("provider", provider)
    .maybeSingle();
  if (error || !data) return null;
  return decryptSecret(data);
}

export async function upsertPanelCredential(params: {
  orgId: string;
  provider: PanelProviderKey;
  apiToken: string;
  status: "connected" | "invalid" | "unknown";
  providerUserId?: string | null;
  providerUserEmail?: string | null;
  validationError?: string | null;
}): Promise<PanelCredentialSummary> {
  const encrypted = encryptSecret(params.apiToken.trim());
  const now = new Date().toISOString();
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("panel_provider_credentials")
    .upsert(
      {
        org_id: params.orgId,
        provider: params.provider,
        encrypted_api_token: encrypted.encryptedApiToken,
        token_iv: encrypted.tokenIv,
        token_auth_tag: encrypted.tokenAuthTag,
        encryption_key_id: encrypted.encryptionKeyId,
        token_hint: tokenHint(params.apiToken),
        status: params.status,
        provider_user_id: params.providerUserId ?? null,
        provider_user_email: params.providerUserEmail ?? null,
        last_validated_at: now,
        validation_error: params.validationError ?? null,
        updated_at: now,
      },
      { onConflict: "org_id,provider" },
    )
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `upsertPanelCredential failed: ${error?.message ?? "no row returned"}`,
    );
  }
  return toSummary(data);
}

export async function updatePanelCredentialValidation(params: {
  orgId: string;
  provider: PanelProviderKey;
  status: "connected" | "invalid" | "unknown";
  providerUserId?: string | null;
  providerUserEmail?: string | null;
  validationError?: string | null;
}): Promise<PanelCredentialSummary | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("panel_provider_credentials")
    .update({
      status: params.status,
      provider_user_id: params.providerUserId ?? null,
      provider_user_email: params.providerUserEmail ?? null,
      last_validated_at: new Date().toISOString(),
      validation_error: params.validationError ?? null,
    })
    .eq("org_id", params.orgId)
    .eq("provider", params.provider)
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return toSummary(data);
}

export async function deletePanelCredential(
  orgId: string,
  provider: PanelProviderKey,
): Promise<void> {
  const supabase = createResearchSupabase();
  const { error } = await supabase
    .from("panel_provider_credentials")
    .delete()
    .eq("org_id", orgId)
    .eq("provider", provider);
  if (error) throw error;
}

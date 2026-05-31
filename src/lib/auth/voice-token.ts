import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import type { Database } from "@/types/database";

/**
 * Findr Voice — Bearer-Auth für die Desktop-/Ingest-Routes (Etappe 1).
 *
 * E1: statische, org-gescopte Tokens (Tabelle voice_api_tokens, gehasht). Der
 * Desktop-Client (oder curl im Test) schickt `Authorization: Bearer <token>`;
 * wir hashen es, finden die Zeile, lesen org_id. Spiegelt die discriminated-
 * union-Rückgabe von requireOrgIdOrError() ({orgId} | {error}), damit die
 * Routes exakt dasselbe Auth-Muster verwenden.
 *
 * E2 (später): DERSELBE Helper erkennt zusätzlich Clerk-OAuth-JWTs (verify via
 * JWKS, org_id aus dem Claim) — der Desktop-Client schickt dann ein Clerk-Token
 * statt eines statischen; KEINE Route-Änderung nötig. Deshalb lebt die Logik
 * hier hinter einer stabilen Funktion, nicht inline in der Route.
 */

// voice_api_tokens ist noch nicht in der generierten database.ts (additive
// Migration 20260627000000) — Inline-Augmentation wie bei
// src/lib/bridge/cs-to-research.ts (bridge_suggestions).
type VoiceApiTokenRow = {
  id: string;
  org_id: string;
  token_hash: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};
type VoiceApiTokenInsert = {
  id?: string;
  org_id: string;
  token_hash: string;
  name?: string;
  created_at?: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
};
type VoiceApiTokenUpdate = Partial<VoiceApiTokenInsert>;

type DatabaseWithVoiceTokens = {
  __InternalSupabase: Database["__InternalSupabase"];
  public: {
    Tables: Database["public"]["Tables"] & {
      voice_api_tokens: {
        Row: VoiceApiTokenRow;
        Insert: VoiceApiTokenInsert;
        Update: VoiceApiTokenUpdate;
        Relationships: [];
      };
    };
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"];
    Enums: Database["public"]["Enums"];
    CompositeTypes: Database["public"]["CompositeTypes"];
  };
};

function createVoiceTokenSupabase(): SupabaseClient<DatabaseWithVoiceTokens> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin operations.",
    );
  }
  return createClient<DatabaseWithVoiceTokens>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Findr-Voice token prefix, so a leaked string is recognizable in logs/scans. */
const TOKEN_PREFIX = "fv_";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function extractBearer(headers: Headers): string | null {
  const raw = headers.get("authorization");
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m ? m[1].trim() : null;
}

/**
 * Hash the presented token and resolve its (non-revoked) org. Returns null for
 * a missing/invalid/revoked token. Best-effort stamps last_used_at.
 */
async function resolveOrgIdFromToken(token: string): Promise<string | null> {
  const supabase = createVoiceTokenSupabase();
  const tokenHash = sha256Hex(token);
  const { data, error } = await supabase
    .from("voice_api_tokens")
    .select("id, org_id, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return null;

  // Best-effort usage stamp — never block auth on it.
  void supabase
    .from("voice_api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => undefined);

  return data.org_id;
}

/**
 * Resolve the internal org UUID from a Bearer token, or return a ready-to-return
 * NextResponse error. Same shape as requireOrgIdOrError(): { orgId } | { error }.
 */
export async function requireOrgIdFromBearer(
  request: { headers: Headers },
): Promise<{ orgId: string } | { error: NextResponse }> {
  const t = await getTranslations("errors");
  const token = extractBearer(request.headers);
  if (!token) {
    return {
      error: NextResponse.json(
        { error: t("unauthorized"), code: "no_auth" },
        { status: 401 },
      ),
    };
  }
  const orgId = await resolveOrgIdFromToken(token);
  if (!orgId) {
    return {
      error: NextResponse.json(
        { error: t("unauthorized"), code: "no_auth" },
        { status: 401 },
      ),
    };
  }
  return { orgId };
}

/**
 * Mint a new org-scoped token. Returns the PLAINTEXT exactly once (the caller
 * must surface it now — only the sha256 hash is persisted). Dev/admin helper
 * used by scripts/create-voice-token.ts; not reachable from any route.
 */
export async function createVoiceApiToken(
  orgId: string,
  name = "Findr Voice token",
): Promise<{ id: string; token: string }> {
  const token = TOKEN_PREFIX + randomBytes(24).toString("base64url");
  const supabase = createVoiceTokenSupabase();
  const { data, error } = await supabase
    .from("voice_api_tokens")
    .insert({ org_id: orgId, token_hash: sha256Hex(token), name })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to create voice token: ${error?.message ?? "no row returned"}`,
    );
  }
  return { id: data.id, token };
}

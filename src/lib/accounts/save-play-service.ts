import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import { getAccount } from "./service";
import {
  getAccountTranscriptCount,
  getLatestHealthScore,
} from "./health-service";
import { DEFAULT_SOLUTION_MODEL } from "@/lib/solution/extractor";
import {
  generateSavePlayLLM,
  type SavePlayInput,
  type SavePlayResult,
} from "./save-play-extractor";

/**
 * Save-Play Service — DB-bound wrapper around the pure save-play extractor.
 * ------------------------------------------------------------------------
 * Loads the account context + latest health analysis + transcripts, calls the
 * Next-/Supabase-/Clerk-FREE extractor (./save-play-extractor) to produce the
 * recommendations, then persists the result into account_save_plays. Mirrors
 * the split between src/lib/solution/extractor.ts (pure LLM) and
 * src/lib/solution/service.ts (DB + integrations).
 *
 * The pure types + LLM function + typed errors live in ./save-play-extractor
 * so the eval runner (evals-save-play/run.ts) can load them under plain tsx
 * without evaluating Clerk's server SDK or next/headers. Production callers
 * (the API route, dashboard pages, components) keep importing from THIS file
 * unchanged — everything below is either a DB function or a re-export.
 */

// ── Re-exports from the pure extractor (backward compat for prod consumers) ──
export {
  generateSavePlayLLM,
  SAVE_PLAY_SYSTEM_PROMPT,
  SavePlayUnavailableError,
} from "./save-play-extractor";
export type {
  SavePlayInput,
  SavePlayRecommendation,
  SavePlayResult,
} from "./save-play-extractor";

// ----------------------------------------------------------------------------
// DB-row shape (Supabase-bound; lives in the service, not the extractor)
// ----------------------------------------------------------------------------

type SavePlayRow = Database["public"]["Tables"]["account_save_plays"]["Row"];

export interface SavePlayReport {
  id: string;
  org_id: string;
  account_id: string;
  status: "completed" | "failed";
  salvageable: "yes" | "no" | "maybe" | null;
  recommendations: SavePlayResult["recommendations"];
  overall: SavePlayResult["overall"];
  source_health_score_id: string | null;
  model: string;
  created_at: string;
}

function toReport(row: SavePlayRow): SavePlayReport {
  return {
    id: row.id,
    org_id: row.org_id,
    account_id: row.account_id,
    status: row.status,
    salvageable: row.salvageable,
    recommendations:
      (row.recommendations as unknown as SavePlayResult["recommendations"]) ?? [],
    overall:
      (row.overall as unknown as SavePlayResult["overall"]) ?? {
        salvageable: "maybe",
        reasoning: "",
      },
    source_health_score_id: row.source_health_score_id,
    model: row.model,
    created_at: row.created_at,
  };
}

/** Join the account's transcripts into one text block for the prompt. */
async function buildAccountTranscript(
  orgId: string,
  accountId: string,
): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("calls")
    .select("transcript")
    .eq("org_id", orgId)
    .eq("account_id", accountId)
    .order("recorded_at", { ascending: false });

  if (error || !data) return "";
  return data
    .map((c) => c.transcript?.trim() ?? "")
    .filter((text) => text.length > 0)
    .join("\n\n---\n\n");
}

/**
 * Generate customer save-play recommendations for an account and persist them
 * to account_save_plays.
 *
 * ON-DEMAND ONLY — runs solely when explicitly invoked (POST
 * /api/accounts/[id]/save-play). The latest health analysis is the required
 * INPUT: no health score, no save-play.
 *
 * Returns null when the account is missing or has no health analysis yet.
 * Propagates SavePlayUnavailableError when the model call ultimately fails (no
 * row written).
 */
export async function generateSavePlay(
  orgId: string,
  accountId: string,
): Promise<SavePlayReport | null> {
  const account = await getAccount(orgId, accountId);
  if (!account) return null;

  // The save-play acts on an existing health analysis — no health, no play.
  const health = await getLatestHealthScore(orgId, accountId);
  if (!health) return null;

  const [transcript, transcriptsCount] = await Promise.all([
    buildAccountTranscript(orgId, accountId),
    getAccountTranscriptCount(orgId, accountId),
  ]);

  const input: SavePlayInput = {
    health: {
      healthScore: health.health_score,
      healthLevel: health.health_level,
      signals: health.signals,
      overallReasoning: health.overall_reasoning,
    },
    account: {
      companyName: account.companyName,
      sponsorName: account.sponsorName,
      sponsorEmail: account.sponsorEmail,
      renewalDate: account.renewalDate,
      mrr: account.mrr,
      valueType: account.valueType,
      currency: account.currency,
      transcriptsCount,
    },
    transcript,
  };

  const model = process.env.SOLUTION_MODEL ?? DEFAULT_SOLUTION_MODEL;
  const result = await generateSavePlayLLM(input, model);

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("account_save_plays")
    .insert({
      org_id: orgId,
      account_id: accountId,
      status: "completed",
      salvageable: result.overall.salvageable,
      recommendations: result.recommendations as unknown as Json,
      overall: result.overall as unknown as Json,
      source_health_score_id: health.id,
      model,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to persist account_save_play: ${error?.message ?? "no row returned"}`,
    );
  }

  return toReport(data);
}

/** Load stored save-plays for an account, newest first. */
export async function getSavePlays(
  orgId: string,
  accountId: string,
  limit = 20,
): Promise<SavePlayReport[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("account_save_plays")
    .select("*")
    .eq("org_id", orgId)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(toReport);
}

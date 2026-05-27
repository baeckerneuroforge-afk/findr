import "server-only";

import { createResearchSupabase } from "@/lib/research/db";
import type {
  EmergentTheme,
  StudySynthesisRecord,
  Tension,
} from "./engine";

/**
 * Read-side service for the study-synthesis UI. Two functions:
 *
 *   - getStudySynthesis(orgId, planId): loads the single persisted row for
 *     a plan (UNIQUE on org_id + plan_id per migration 20260617*). Returns
 *     null when no synthesis has been computed yet — the UI then renders
 *     the empty state with the "create now" CTA.
 *
 *   - countInsightsForPlanSince(orgId, planId, since): drives the
 *     "{n} new interviews since the last synthesis" badge. Counts Stage-1
 *     insights in product_discovery_insights filtered by plan_id and
 *     analyzed_at > since. `since=null` is allowed for "no synthesis yet"
 *     and returns the count of all insights for the plan.
 *
 * Types come from engine.ts because the SAME shapes are written there
 * (by Stage 2) and read here (by the UI). One source of truth — at the
 * UI ↔ engine merge boundary either side breaking the contract surfaces
 * immediately at type-check.
 */

export type { EmergentTheme, Tension, StudySynthesisRecord };

export async function getStudySynthesis(
  orgId: string,
  planId: string,
): Promise<StudySynthesisRecord | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("study_synthesis")
    .select("*")
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    org_id: data.org_id,
    plan_id: data.plan_id,
    overview: data.overview,
    emergent_themes:
      (data.emergent_themes as unknown as EmergentTheme[]) ?? [],
    tensions: (data.tensions as unknown as Tension[]) ?? [],
    based_on_count: data.based_on_count,
    synthesized_at: data.synthesized_at,
    model: data.model,
  };
}

/**
 * Counts Stage-1 insights for a plan since a given timestamp. Used for the
 * "{n} new since the last synthesis" badge.
 *
 * Uses `head: true` with `count: "exact"` so the network only carries the
 * count, not the rows. `gt` (not gte) on `analyzed_at` — an insight stamped
 * at the exact same instant as the synthesis is part of that synthesis, not
 * "new" since it (in practice the ISO collision is astronomically rare; we
 * still pick the semantically correct comparator).
 */
export async function countInsightsForPlanSince(
  orgId: string,
  planId: string,
  since: string | null,
): Promise<number> {
  const supabase = createResearchSupabase();
  let query = supabase
    .from("product_discovery_insights")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("plan_id", planId);
  if (since) query = query.gt("analyzed_at", since);
  const { count, error } = await query;
  if (error || count === null) return 0;
  return count;
}

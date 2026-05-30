import "server-only";

import { createResearchSupabase } from "@/lib/research/db";
import {
  normalizeEmergentThemes,
  normalizeTensions,
} from "@/lib/schemas/synthesis";
import type {
  EmergentTheme,
  Tension,
  TensionSide,
} from "@/lib/schemas/synthesis";

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
 * Types come from `@/lib/schemas/synthesis` — the same Zod schemas the
 * Stage-2 engine validates against before persisting. The schema's
 * StudySynthesisResult covers (overview / emergent_themes / tensions);
 * the persisted study_synthesis row wraps that with DB-side metadata
 * (id / org_id / plan_id / based_on_count / synthesized_at / model),
 * which the local StudySynthesisRecord below adds.
 */

/** Persisted-row view: schema's content fields PLUS the DB metadata the UI
 *  needs for the "based on N · stand X · M new since" header. `overview`
 *  is nullable here (the migration column is nullable; an empty-seed row
 *  exists before the engine has ever run) — the schema's
 *  StudySynthesisResult.overview is non-null, but that's the output
 *  contract of a successful synth, not the DB state. */
export interface StudySynthesisRecord {
  id: string;
  org_id: string;
  plan_id: string;
  overview: string | null;
  emergent_themes: EmergentTheme[];
  tensions: Tension[];
  based_on_count: number;
  synthesized_at: string | null;
  model: string | null;
}

export type { EmergentTheme, Tension, TensionSide };

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
    emergent_themes: normalizeEmergentThemes(data.emergent_themes),
    tensions: normalizeTensions(data.tensions),
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

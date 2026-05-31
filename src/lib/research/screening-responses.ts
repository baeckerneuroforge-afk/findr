import "server-only";

import { createResearchSupabase } from "./db";

/**
 * Append the anonymous screening quote row (Phase 4, §2.3). One row per
 * completed screening: ONLY plan_id + verdict + timestamp — KEIN invite_id,
 * KEIN Profil, KEINE Antworten. Powers the per-study Abgewiesenen-Quote
 * (rejected / (qualified + rejected)) without ever storing who or what.
 *
 * Best-effort by design: the row is analytics-only, so a failed insert is
 * logged and swallowed — it must NEVER block the participant's
 * qualified→interview transition or the rejection screen.
 */
export async function recordScreeningResponse(
  orgId: string,
  planId: string,
  verdict: "qualified" | "rejected",
): Promise<void> {
  const supabase = createResearchSupabase();
  const { error } = await supabase
    .from("research_screening_responses")
    .insert({ org_id: orgId, plan_id: planId, verdict });
  if (error) {
    console.error("[recordScreeningResponse] insert failed:", error.message);
  }
}

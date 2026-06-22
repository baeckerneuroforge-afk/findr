import type { Deal } from "@/lib/deals/types";

/**
 * Cron-Guards für die Reanalyse, ausgelagert aus route.ts. Next.js erlaubt in
 * einer route.ts NUR Route-Handler + bekannte Config-Exports — ein exportierter
 * Helper bricht den `next build`-Route-Typecheck. Verhalten unverändert; die
 * Tests importieren diese Funktionen von hier (helpers), nicht mehr von route.
 */

export function isRealActiveDeal(
  deal: Pick<Deal, "stage" | "dataSource">,
): boolean {
  return (
    !["closed_won", "closed_lost"].includes(deal.stage) &&
    deal.dataSource !== "mock"
  );
}

export function getCronAnalysisMode(
  env: { ANTHROPIC_API_KEY?: string } = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  },
): "heuristic_only" | "heuristic_with_ai_available" {
  return env.ANTHROPIC_API_KEY
    ? "heuristic_with_ai_available"
    : "heuristic_only";
}

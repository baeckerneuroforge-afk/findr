import {
  MIN_CHART_BARS,
  type FrequencyChartData,
} from "@/lib/charts";
import type { EmergentTheme } from "@/lib/schemas/synthesis";

/**
 * Deterministic chart builders for the single-study synthesis. PURE — every
 * number comes from a field the engine already computes/overrides
 * (EmergentTheme.frequency = unique(sourceInsightIds).length), so a chart can
 * never show an LLM-invented count. Returns null when there is nothing worth
 * charting (see MIN_CHART_BARS).
 */

/** Themes ranked by how many respondents carry them ("14 / 22 Interviews").
 *  Sorted high→low so the chart reads as a prevalence ranking. */
export function buildThemeFrequencyChart(
  themes: Pick<EmergentTheme, "title" | "frequency">[],
  basedOnCount: number,
): FrequencyChartData | null {
  const bars = themes
    .filter((t) => t.frequency > 0 && t.title.trim() !== "")
    .map((t) => ({ label: t.title, value: t.frequency }))
    .sort((a, b) => b.value - a.value);
  if (bars.length < MIN_CHART_BARS) return null;
  return { bars, total: basedOnCount > 0 ? basedOnCount : undefined };
}

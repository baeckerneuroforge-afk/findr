import {
  MIN_CHART_BARS,
  type FrequencyChartData,
} from "@/lib/charts";
import type { MetaSynthesisConvergentTheme } from "@/lib/schemas/meta-synthesis";
import type { MetaSynthesisStudyRef } from "@/lib/meta-synthesis/service";

/**
 * Deterministic chart builders for the meta-synthesis. PURE — study_frequency is
 * the engine-overridden distinct-study count and basedOnCount is a stored server
 * number, so both charts are honest by construction. Returns null when there is
 * nothing worth charting.
 */

/** Convergent themes ranked by how many studies carry them ("in 3 / 3 Studien"). */
export function buildConvergentFrequencyChart(
  themes: Pick<MetaSynthesisConvergentTheme, "title" | "study_frequency">[],
  totalStudies: number,
): FrequencyChartData | null {
  const bars = themes
    .filter((t) => t.study_frequency > 0 && t.title.trim() !== "")
    .map((t) => ({ label: t.title, value: t.study_frequency }))
    .sort((a, b) => b.value - a.value);
  if (bars.length < MIN_CHART_BARS) return null;
  return { bars, total: totalStudies > 0 ? totalStudies : undefined };
}

/** Interview weight per compared study — how much evidence each study brought. */
export function buildInterviewsPerStudyChart(
  studies: Pick<MetaSynthesisStudyRef, "studyTitle" | "basedOnCount">[],
): FrequencyChartData | null {
  const bars = studies
    .filter((s) => s.basedOnCount > 0 && s.studyTitle.trim() !== "")
    .map((s) => ({ label: s.studyTitle, value: s.basedOnCount }))
    .sort((a, b) => b.value - a.value);
  if (bars.length < MIN_CHART_BARS) return null;
  return { bars };
}

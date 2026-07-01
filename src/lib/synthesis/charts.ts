import {
  MIN_CHART_BARS,
  MIN_DISTRIBUTION_SLICES,
  type DistributionChartData,
  type DivergingBarData,
  type FrequencyChartData,
} from "@/lib/charts";
import type { EmergentTheme, Tension } from "@/lib/schemas/synthesis";

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

/** Audience segments as a donut — each slice a persona, sized by its server-
 *  overridden shareCount (= unique respondents in the cluster). Colours are
 *  assigned by rank so the biggest segment is the primary violet. */
export function buildPersonaDistribution(
  personas: { name: string; shareCount: number }[],
): DistributionChartData | null {
  const slices = personas
    .filter((p) => p.shareCount > 0 && p.name.trim() !== "")
    .sort((a, b) => b.shareCount - a.shareCount)
    .map((p, i) => ({ label: p.name, value: p.shareCount, colorIndex: i }));
  if (slices.length < MIN_DISTRIBUTION_SLICES) return null;
  const total = slices.reduce((n, s) => n + s.value, 0);
  return { slices, total };
}

/** Answer directness (Turn-Signals) as a donut. The 4 category labels are
 *  passed in already-translated (the builder stays i18n-free); colours are
 *  semantic: direct=teal, partial=amber, evasive=coral, declined=gray. */
export function buildSignalsDistribution(
  summary: {
    direct: number;
    partial: number;
    evasive: number;
    declined: number;
  } | null,
  labels: { direct: string; partial: string; evasive: string; declined: string },
): DistributionChartData | null {
  if (!summary) return null;
  const raw = [
    { label: labels.direct, value: summary.direct, colorIndex: 1 },
    { label: labels.partial, value: summary.partial, colorIndex: 3 },
    { label: labels.evasive, value: summary.evasive, colorIndex: 2 },
    { label: labels.declined, value: summary.declined, colorIndex: 4 },
  ];
  const slices = raw.filter((s) => s.value > 0);
  const total = slices.reduce((n, s) => n + s.value, 0);
  if (slices.length < MIN_DISTRIBUTION_SLICES || total === 0) return null;
  return { slices, total };
}

/** A tension as a two-sided split — each side sized by how many respondents it
 *  drew (sourceInsightIds length). Null when either side has no cited source. */
export function buildTensionDiverging(tension: Tension): DivergingBarData | null {
  const left = tension.side_a.sourceInsightIds.length;
  const right = tension.side_b.sourceInsightIds.length;
  if (left === 0 || right === 0) return null;
  return {
    leftLabel: tension.side_a.label,
    rightLabel: tension.side_b.label,
    leftValue: left,
    rightValue: right,
    caption: tension.description,
  };
}

/** Stimulus preference as a donut — each slice a stimulus position, sized by its
 *  server-counted preference votes. Labels are passed in already-formatted. */
export function buildStimulusPreference(
  votes: { position: number; count: number }[],
  labelFor: (position: number) => string,
): DistributionChartData | null {
  const slices = votes
    .filter((v) => v.count > 0)
    .map((v, i) => ({
      label: labelFor(v.position),
      value: v.count,
      colorIndex: i,
    }));
  if (slices.length < MIN_DISTRIBUTION_SLICES) return null;
  const total = slices.reduce((n, s) => n + s.value, 0);
  if (total === 0) return null;
  return { slices, total };
}

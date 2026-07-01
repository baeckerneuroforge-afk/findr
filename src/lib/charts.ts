/**
 * Chart primitives for the synthesis surfaces. PURE (no server-only, no network,
 * no React) so the SAME spec can be built once and rendered in three places from
 * ONE data path: the web view (SVG), the PDF export (pdfkit rects) and the PPTX
 * export (pptxgenjs). The builders live per domain (synthesis/charts.ts,
 * meta-synthesis/charts.ts); this file only holds the shared shape.
 *
 * HONESTY CONTRACT: a FrequencyChartData is only ever built from a
 * server-computed / server-overridden count (emergent-theme `frequency`,
 * meta `study_frequency`, `based_on_count`) — NEVER from an LLM-produced number.
 * Every bar therefore visualizes a number the app already trusts. Builders
 * return `null` when there is nothing worth charting (fewer than 2 comparable
 * bars), so "wo angebracht" is enforced at the source, not in the renderer.
 */

export interface ChartBar {
  /** Verbatim category label (a theme title, a study name) — NOT translated. */
  label: string;
  /** The server-computed count this bar represents. */
  value: number;
}

export interface FrequencyChartData {
  bars: ChartBar[];
  /** Optional denominator. When set, bars scale to it and the renderer shows
   *  "value / total" (e.g. "14 / 22 Interviews"). When absent, bars scale to the
   *  largest value in the set. */
  total?: number;
}

/** Minimum comparable bars for a frequency chart to be worth showing. */
export const MIN_CHART_BARS = 2;

/**
 * Categorical chart palette — fixed data-colors (charts legitimately use stable
 * per-category colors, unlike UI chrome). Shared by all three renderers so a
 * slice/bar has the SAME colour in web, PDF and PPTX. Hex WITHOUT '#'-less: kept
 * WITH '#' for web/pdfkit; the PPTX renderer strips the leading '#'. Drawn from
 * the CDS ramp mid-tones (purple, teal, coral, amber, gray, blue, pink, green).
 */
export const CHART_PALETTE = [
  "#534AB7", // 0 purple
  "#1D9E75", // 1 teal
  "#D85A30", // 2 coral
  "#EF9F27", // 3 amber
  "#888780", // 4 gray
  "#378ADD", // 5 blue
  "#D4537E", // 6 pink
  "#639922", // 7 green
] as const;

export function chartColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

/** One slice of a part-of-a-whole (donut/pie) chart. */
export interface DistributionSlice {
  /** Already-resolved DISPLAY label (persona name, or a translated category). */
  label: string;
  /** The server-computed count this slice represents. */
  value: number;
  /** Stable index into CHART_PALETTE — the slice's colour across all renderers. */
  colorIndex: number;
}

export interface DistributionChartData {
  slices: DistributionSlice[];
  /** The whole the slices sum to (denominator for the percentages). */
  total: number;
}

/** Minimum non-zero slices for a distribution chart to be worth showing. */
export const MIN_DISTRIBUTION_SLICES = 2;

/** A bar chart with a labelled value axis (the „richtige" bar chart). Reuses
 *  ChartBar; adds axis metadata the axis renderer needs. */
export interface AxisBarChartData {
  bars: ChartBar[];
  /** The value the Y axis tops out at (a round number ≥ max bar value). */
  axisMax: number;
  /** Tick values along the Y axis (ascending, including 0 and axisMax). */
  ticks: number[];
}

/** One two-sided divergence (a tension): a left vs. right count. */
export interface DivergingBarData {
  leftLabel: string;
  rightLabel: string;
  leftValue: number;
  rightValue: number;
  /** Short description of what the two sides disagree about. */
  caption: string;
}

/** One usability KPI tile — a server-deterministic metric. */
export interface KpiTile {
  label: string;
  /** Pre-formatted display value ("72 %", "1:48 min", "3,4"). */
  display: string;
}

/**
 * Round a max value up to a "nice" axis top and derive evenly-spaced ticks.
 * Pure — used by every axis-bar builder so web/PDF/PPTX share identical ticks.
 */
export function niceAxis(maxValue: number, tickCount = 4): {
  axisMax: number;
  ticks: number[];
} {
  const safeMax = Math.max(1, Math.ceil(maxValue));
  const rawStep = safeMax / tickCount;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const niceStep =
    norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  const step = niceStep * mag;
  const axisMax = Math.ceil(safeMax / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= axisMax + 1e-9; t += step) ticks.push(Math.round(t));
  return { axisMax, ticks };
}

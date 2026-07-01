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

import type { FrequencyChartData } from "@/lib/charts";

/**
 * Honest horizontal-bar chart for the synthesis surfaces. Renders a
 * FrequencyChartData (built purely from server counts) as Tailwind bars — no
 * chart library, dark-mode-safe via the app's neutral/primary scales. Purely
 * presentational + server-safe; the PDF/PPTX exports draw the SAME data with
 * their own primitives (one data path, three renderers).
 *
 * `title`/`unit` are passed in already-localized by the caller (the pure builder
 * stays i18n-free). Bar labels are verbatim category names (theme/study titles).
 */
export function FrequencyBarChart({
  chart,
  title,
  unit,
}: {
  chart: FrequencyChartData;
  title: string;
  /** Optional noun for the denominator caption, e.g. "Interviews" / "Studien". */
  unit?: string;
}) {
  const scaleMax = chart.total ?? Math.max(...chart.bars.map((b) => b.value), 1);

  return (
    <div className="rounded-lg border border-neutral-200 bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <svg
          className="h-4 w-4 text-neutral-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M4 20V4M4 20h16M8 20v-6M13 20v-10M18 20v-4" strokeLinecap="round" />
        </svg>
        <span className="text-small font-medium text-neutral-600">{title}</span>
        {unit && chart.total ? (
          <span className="text-caption text-neutral-400">
            · {chart.total} {unit}
          </span>
        ) : null}
      </div>
      <ul className="space-y-2.5">
        {chart.bars.map((bar, i) => (
          <li key={i}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-small text-neutral-800">
                {bar.label}
              </span>
              <span className="shrink-0 text-caption tabular-nums text-neutral-500">
                {chart.total ? `${bar.value} / ${chart.total}` : bar.value}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-primary-500"
                style={{
                  width: `${Math.round((bar.value / scaleMax) * 100)}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { barAxis, type FrequencyChartData } from "@/lib/charts";

/**
 * „Richtiges" horizontal bar chart with a labelled value axis + gridlines —
 * hand-rolled SVG, no chart lib. Drop-in replacement for FrequencyBarChart (same
 * props / same builders), just a proper chart: category labels on the Y side,
 * a value axis with ticks + gridlines + unit on the X (bottom). Every bar is a
 * server count, scaled to a „nice" axis top, so it can't misrepresent the data.
 * Dark-mode safe (tokens for chrome, one fixed data-colour for the bars).
 */
export function AxisBarChart({
  chart,
  title,
  unit,
}: {
  chart: FrequencyChartData;
  title: string;
  /** Value-axis unit, e.g. "Interviews" / "Studien". */
  unit?: string;
}) {
  const bars = chart.bars.slice(0, 8);
  const { axisMax, ticks } = barAxis(chart);

  // SVG geometry (viewBox units).
  const W = 340;
  const labelW = 118;
  const barX = labelW + 8;
  const barAreaW = W - barX - 8;
  const rowH = 30;
  const barH = 16;
  const chartH = bars.length * rowH;
  const axisH = 24;
  const H = chartH + axisH;
  const xForValue = (v: number) => barX + (v / axisMax) * barAreaW;

  const truncate = (s: string, max = 22) =>
    s.length > max ? `${s.slice(0, max - 1)}…` : s;

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
        {unit ? (
          <span className="text-caption text-neutral-400">· {unit}</span>
        ) : null}
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={title}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* gridlines + X-axis ticks */}
        {ticks.map((tick, i) => {
          const x = xForValue(tick);
          return (
            <g key={`tick-${i}`}>
              <line
                x1={x}
                y1={0}
                x2={x}
                y2={chartH}
                stroke="var(--border)"
                strokeWidth={tick === 0 ? 1 : 0.5}
                strokeDasharray={tick === 0 ? undefined : "3 3"}
              />
              <text
                x={x}
                y={chartH + 14}
                textAnchor="middle"
                className="fill-neutral-400"
                style={{ fontSize: 9 }}
              >
                {tick}
              </text>
            </g>
          );
        })}
        {/* unit label at the axis end */}
        {unit ? (
          <text
            x={W - 4}
            y={chartH + 14}
            textAnchor="end"
            className="fill-neutral-400"
            style={{ fontSize: 8.5 }}
          >
            {unit}
          </text>
        ) : null}
        {/* bars + category labels */}
        {bars.map((bar, i) => {
          const cy = i * rowH + rowH / 2;
          const w = Math.max(2, (bar.value / axisMax) * barAreaW);
          return (
            <g key={`bar-${i}`}>
              <text
                x={labelW}
                y={cy + 3}
                textAnchor="end"
                className="fill-neutral-800"
                style={{ fontSize: 9.5 }}
              >
                {truncate(bar.label)}
              </text>
              <rect
                x={barX}
                y={cy - barH / 2}
                width={w}
                height={barH}
                rx={3}
                fill="#534AB7"
              />
              <text
                x={barX + w + 4}
                y={cy + 3}
                className="fill-neutral-500"
                style={{ fontSize: 9 }}
              >
                {chart.total ? `${bar.value} / ${chart.total}` : bar.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

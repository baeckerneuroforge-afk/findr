import { chartColor, type DistributionChartData } from "@/lib/charts";

/**
 * Honest donut chart for part-of-a-whole distributions (persona segments, answer
 * directness, …). Hand-rolled SVG — no chart lib. Each slice's value comes from a
 * server count; the arc lengths are exact fractions of the total, so the ring can
 * never misrepresent the numbers. Dark-mode safe: the ring uses fixed categorical
 * data-colours (legitimate for charts), everything else uses the app's tokens.
 *
 * `title` is passed already-localized; slice labels are already-resolved display
 * strings (the pure builder stays i18n-free).
 */
export function DonutChart({
  data,
  title,
  centerLabel,
  centerSub,
}: {
  data: DistributionChartData;
  title: string;
  /** Big number in the hole (e.g. the total, or the slice count). */
  centerLabel?: string;
  /** Small caption under the center number. */
  centerSub?: string;
}) {
  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = 42;
  const sw = 16;
  const circumference = 2 * Math.PI * r;

  let cumulative = 0;
  const segments = data.slices.map((slice) => {
    const fraction = data.total > 0 ? slice.value / data.total : 0;
    const len = fraction * circumference;
    const seg = {
      color: chartColor(slice.colorIndex),
      dash: `${len} ${circumference - len}`,
      // Negative cumulative offset places this arc after the previous ones.
      offset: -cumulative,
    };
    cumulative += len;
    return seg;
  });

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
          <path d="M12 3a9 9 0 1 0 9 9h-9V3z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-small font-medium text-neutral-600">{title}</span>
      </div>
      <div className="flex items-center gap-4">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="shrink-0"
          role="img"
          aria-label={title}
        >
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={sw}
              strokeDasharray={seg.dash}
              strokeDashoffset={seg.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          ))}
          {centerLabel ? (
            <text
              x={cx}
              y={centerSub ? cy - 2 : cy + 4}
              textAnchor="middle"
              className="fill-neutral-900"
              style={{ fontSize: 18, fontWeight: 500 }}
            >
              {centerLabel}
            </text>
          ) : null}
          {centerSub ? (
            <text
              x={cx}
              y={cy + 13}
              textAnchor="middle"
              className="fill-neutral-400"
              style={{ fontSize: 9 }}
            >
              {centerSub}
            </text>
          ) : null}
        </svg>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {data.slices.map((slice, i) => (
            <li
              key={i}
              className="flex items-center gap-2 text-small text-neutral-700"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: chartColor(slice.colorIndex) }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">{slice.label}</span>
              <span className="shrink-0 tabular-nums text-caption text-neutral-400">
                {data.total > 0
                  ? `${Math.round((slice.value / data.total) * 100)} %`
                  : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

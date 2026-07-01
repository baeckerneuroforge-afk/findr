import { chartColor, type DivergingBarData } from "@/lib/charts";

/**
 * Two-sided split bar for a tension (side A vs. side B), sized by how many
 * respondents each side drew — both counts are server numbers (sourceInsightIds
 * lengths), so the split can't misrepresent the balance. Hand-rolled, dark-mode
 * safe. Labels are already-resolved (verbatim side labels).
 */
export function DivergingBar({ data }: { data: DivergingBarData }) {
  const total = data.leftValue + data.rightValue || 1;
  const leftPct = Math.round((data.leftValue / total) * 100);

  return (
    <div className="rounded-md border border-neutral-200 bg-card p-3">
      <div className="mb-2 flex items-start justify-between gap-3 text-small">
        <span className="min-w-0 text-neutral-700">
          {data.leftLabel}{" "}
          <span className="tabular-nums text-neutral-400">
            ({data.leftValue})
          </span>
        </span>
        <span className="min-w-0 text-right text-neutral-700">
          {data.rightLabel}{" "}
          <span className="tabular-nums text-neutral-400">
            ({data.rightValue})
          </span>
        </span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full">
        <div
          style={{ width: `${leftPct}%`, backgroundColor: chartColor(0) }}
          aria-hidden="true"
        />
        <div
          style={{ width: `${100 - leftPct}%`, backgroundColor: chartColor(2) }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

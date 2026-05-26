import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { HealthLevel } from "@/lib/accounts/types";

/**
 * Health-level breakdown — count per level (critical → thriving), visualized
 * as a horizontal bar row per level. The CS-side echo of StageBreakdownChart
 * (deal stages → counts); kept lighter because health distribution is
 * single-value-per-row (no weighted-vs-total duality the forecast has).
 */

interface HealthLevelBreakdownProps {
  /** Count of accounts at each health level. Levels missing from the input are
   *  rendered as a zero row to keep the band-ordering stable. */
  counts: Record<HealthLevel, number>;
}

const ROW_ORDER: HealthLevel[] = [
  "critical",
  "at_risk",
  "lukewarm",
  "healthy",
  "thriving",
];

const ROW_META: Record<
  HealthLevel,
  { label: string; barColor: string; valueColor: string }
> = {
  critical: {
    label: "Critical",
    barColor: "bg-danger-500",
    valueColor: "text-danger-700",
  },
  at_risk: {
    label: "At risk",
    barColor: "bg-warning-500",
    valueColor: "text-warning-700",
  },
  lukewarm: {
    label: "Lukewarm",
    barColor: "bg-neutral-400",
    valueColor: "text-neutral-700",
  },
  healthy: {
    label: "Healthy",
    barColor: "bg-success-500",
    valueColor: "text-success-700",
  },
  thriving: {
    label: "Thriving",
    barColor: "bg-success-600",
    valueColor: "text-success-700",
  },
};

export function HealthLevelBreakdown({ counts }: HealthLevelBreakdownProps) {
  const total = ROW_ORDER.reduce((sum, level) => sum + (counts[level] ?? 0), 0);
  const max = Math.max(...ROW_ORDER.map((level) => counts[level] ?? 0), 1);

  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="text-h2 text-neutral-900">Health distribution</h2>
          <p className="mt-1 text-small text-neutral-500">
            How your analyzed accounts split across the five health levels.
          </p>
        </div>
      </CardHeader>
      <CardBody>
        {total === 0 ? (
          <div className="py-8 text-center text-body text-neutral-500">
            No analyzed accounts yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {ROW_ORDER.map((level) => {
              const count = counts[level] ?? 0;
              const widthPct = (count / max) * 100;
              const sharePct = total > 0 ? (count / total) * 100 : 0;
              const meta = ROW_META[level];
              return (
                <li
                  key={level}
                  className="grid grid-cols-[130px_1fr_auto] items-center gap-4"
                >
                  <div className="text-body-strong text-neutral-900">
                    {meta.label}
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={`h-full rounded-full transition-[width] ${meta.barColor}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <div className="flex items-baseline gap-2 whitespace-nowrap">
                    <span
                      className={`text-body-strong tabular-nums ${meta.valueColor}`}
                    >
                      {count}
                    </span>
                    <span className="text-small text-neutral-500 tabular-nums">
                      {sharePct.toFixed(0)}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export default HealthLevelBreakdown;

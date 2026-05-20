import type { RiskLevel } from "@/lib/deals/types";

interface RiskBadgeProps {
  score?: number;
  level?: RiskLevel;
  size?: "sm" | "md" | "large";
}

function deriveLevel(score: number): RiskLevel {
  if (score <= 30) return "low";
  if (score <= 60) return "medium";
  if (score <= 80) return "high";
  return "critical";
}

const LEVEL_STYLES: Record<RiskLevel, string> = {
  low: "bg-success-50 text-success-700 border-success-500/30",
  medium: "bg-warning-50 text-warning-700 border-warning-500/30",
  high: "bg-orange-50 text-orange-700 border-orange-500/40",
  critical: "bg-danger-50 text-danger-700 border-danger-500/40",
};

const SIZE_STYLES = {
  sm: "px-2 py-0.5 text-caption",
  md: "px-2.5 py-1 text-small",
  large: "px-3 py-1.5 text-body-strong",
} as const;

export function RiskBadge({ score, level, size = "md" }: RiskBadgeProps) {
  if (score === undefined) {
    return (
      <span
        className={`inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 font-medium italic text-neutral-400 ${SIZE_STYLES[size]}`}
      >
        Not analyzed
      </span>
    );
  }

  const resolvedLevel = level ?? deriveLevel(score);
  const isCritical = resolvedLevel === "critical";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium ${LEVEL_STYLES[resolvedLevel]} ${SIZE_STYLES[size]}`}
    >
      {isCritical && (
        <span
          className="relative flex h-1.5 w-1.5"
          aria-hidden="true"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-500 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-danger-500" />
        </span>
      )}
      {score} / 100
    </span>
  );
}

export default RiskBadge;

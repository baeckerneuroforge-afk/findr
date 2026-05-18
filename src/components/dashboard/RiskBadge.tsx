import type { RiskLevel } from "@/lib/deals/types";

interface RiskBadgeProps {
  score?: number;
  level?: RiskLevel;
  size?: "sm" | "md";
}

function deriveLevel(score: number): RiskLevel {
  if (score <= 30) return "low";
  if (score <= 60) return "medium";
  if (score <= 80) return "high";
  return "critical";
}

const LEVEL_STYLES: Record<RiskLevel, string> = {
  low: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  high: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  critical: "bg-alert-500/20 text-alert-400 border border-alert-500/40",
};

const SIZE_STYLES = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
} as const;

export default function RiskBadge({
  score,
  level,
  size = "md",
}: RiskBadgeProps) {
  if (score === undefined) {
    return (
      <span
        className={`inline-flex items-center rounded-md border border-mist/15 bg-mist/5 font-medium text-mist ${SIZE_STYLES[size]}`}
      >
        —
      </span>
    );
  }

  const resolvedLevel = level ?? deriveLevel(score);
  const isCritical = resolvedLevel === "critical";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium ${LEVEL_STYLES[resolvedLevel]} ${SIZE_STYLES[size]}`}
    >
      {isCritical && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-alert-500 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-alert-500" />
        </span>
      )}
      {score} / 100
    </span>
  );
}

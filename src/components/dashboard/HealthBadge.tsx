import type { HealthLevel } from "@/lib/accounts/types";

interface HealthBadgeProps {
  /** 0-100; high = healthy. Undefined renders a "Not analyzed" pill. */
  score?: number;
  level?: HealthLevel;
  size?: "sm" | "md" | "large";
}

function deriveLevel(score: number): HealthLevel {
  if (score >= 67) return "healthy";
  if (score >= 34) return "at_risk";
  return "critical";
}

const LEVEL_STYLES: Record<HealthLevel, string> = {
  healthy: "bg-success-50 text-success-700 border-success-500/30",
  at_risk: "bg-warning-50 text-warning-700 border-warning-500/30",
  critical: "bg-danger-50 text-danger-700 border-danger-500/40",
};

const LEVEL_LABELS: Record<HealthLevel, string> = {
  healthy: "Healthy",
  at_risk: "At risk",
  critical: "Critical",
};

const SIZE_STYLES = {
  sm: "px-2 py-0.5 text-caption",
  md: "px-2.5 py-1 text-small",
  large: "px-3 py-1.5 text-body-strong",
} as const;

export function HealthBadge({ score, level, size = "md" }: HealthBadgeProps) {
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
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-500 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-danger-500" />
        </span>
      )}
      {score} / 100 · {LEVEL_LABELS[resolvedLevel]}
    </span>
  );
}

export default HealthBadge;

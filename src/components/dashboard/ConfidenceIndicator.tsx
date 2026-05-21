interface ConfidenceIndicatorProps {
  confidence: number;
  size?: "sm" | "md";
}

function getConfidenceLevel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

export function ConfidenceIndicator({
  confidence,
  size = "sm",
}: ConfidenceIndicatorProps) {
  const clamped = Math.max(0, Math.min(1, confidence));
  const pct = Math.round(clamped * 100);
  const level = getConfidenceLevel(clamped);

  const labels = {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
  };

  const dotColor = {
    high: "bg-success-500",
    medium: "bg-primary-500",
    low: "bg-neutral-400",
  };

  return (
    <div
      className="inline-flex items-center gap-1.5"
      aria-label={`${labels[level]} ${pct}%`}
    >
      <div className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => {
          const threshold = (i + 1) / 3;
          const filled = clamped >= threshold - 0.16;

          return (
            <span
              key={i}
              className={`h-3 w-1 rounded-full ${
                filled ? dotColor[level] : "bg-neutral-200"
              }`}
            />
          );
        })}
      </div>
      {size === "md" && (
        <span className="text-caption text-neutral-500">
          {labels[level]} <span className="text-neutral-400">· {pct}%</span>
        </span>
      )}
    </div>
  );
}

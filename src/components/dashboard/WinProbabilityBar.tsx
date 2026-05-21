interface WinProbabilityBarProps {
  probability: number;
  confidence?: "high" | "medium" | "low";
}

function getProbabilityTone(probability: number) {
  if (probability > 75) {
    return {
      bar: "bg-success-500",
      text: "text-success-700",
      label: "Strong",
    };
  }
  if (probability >= 50) {
    return {
      bar: "bg-primary-500",
      text: "text-primary-700",
      label: "Likely",
    };
  }
  if (probability >= 25) {
    return {
      bar: "bg-warning-500",
      text: "text-warning-700",
      label: "Watch",
    };
  }
  return {
    bar: "bg-danger-500",
    text: "text-danger-700",
    label: "Weak",
  };
}

export function WinProbabilityBar({
  probability,
  confidence,
}: WinProbabilityBarProps) {
  const tone = getProbabilityTone(probability);
  const clamped = Math.max(0, Math.min(100, probability));

  return (
    <div className="min-w-[160px]">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className={`text-small font-medium ${tone.text}`}>
          {clamped}%
        </span>
        <span className="text-caption text-neutral-500">
          {tone.label}
          {confidence ? ` · ${confidence}` : ""}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`h-full rounded-full ${tone.bar}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

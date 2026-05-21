interface WinProbabilityBarProps {
  probability: number;
  confidence?: "high" | "medium" | "low";
}

function getProbabilityTone(probability: number) {
  if (probability >= 75) {
    return {
      bar: "bg-success-500",
      dot: "bg-success-500",
      text: "text-success-700",
      label: "Strong",
    };
  }
  if (probability < 25) {
    return {
      bar: "bg-danger-500",
      dot: "bg-danger-500",
      text: "text-danger-700",
      label: "Unlikely",
    };
  }

  return {
    bar: "bg-primary-500",
    dot: "bg-neutral-300",
    text: "text-neutral-700",
    label: probability >= 50 ? "Likely" : "Possible",
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
        <span className={`inline-flex items-center gap-1.5 text-small font-medium ${tone.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
          <span>{clamped}%</span>
        </span>
        <span className="text-caption text-neutral-500">
          {tone.label}
          {confidence ? (
            <span className="text-neutral-400"> · {confidence}</span>
          ) : null}
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

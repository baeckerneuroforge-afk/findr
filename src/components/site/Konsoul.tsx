type Mood = "smile" | "think" | "wow" | "wink" | "listen" | "scan";

export function Konsoul({
  size = 64,
  mood = "smile",
  className = "",
  label,
}: {
  size?: number;
  mood?: Mood;
  className?: string;
  label?: string;
}) {
  const eye = (cx: number) => (
    <circle cx={cx} cy={42} r={4} fill="currentColor" className="blink" />
  );
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <rect x="2" y="2" width="96" height="96" rx="22" fill="var(--card)" stroke="currentColor" strokeWidth="1.4" />
      <g fill="currentColor" opacity="0.55">
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="18" cy="12" r="1.6" />
        <circle cx="24" cy="12" r="1.6" />
      </g>
      <text x="32" y="15" fontSize="7" fill="currentColor" opacity="0.55" fontFamily="ui-monospace, monospace">
        {label ?? "konsoul"}
      </text>

      {eye(38)}
      {mood === "wink" ? (
        <path d="M58 42 h8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      ) : (
        eye(62)
      )}

      {mood === "smile" && (
        <path d="M36 62 Q50 76 64 62" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mood === "wow" && <ellipse cx="50" cy="68" rx="6" ry="8" fill="currentColor" />}
      {mood === "think" && (
        <path d="M36 66 H64" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      )}
      {mood === "wink" && (
        <path d="M36 62 Q50 74 64 62" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mood === "listen" && (
        <>
          <path d="M36 64 Q50 70 64 64" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7">
            <path d="M78 36 q6 8 0 16" fill="none" />
            <path d="M84 32 q10 12 0 24" fill="none" />
          </g>
        </>
      )}
      {mood === "scan" && (
        <>
          <path d="M36 64 H64" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <line x1="14" y1="76" x2="86" y2="76" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <circle cx="50" cy="76" r="2.5" fill="currentColor" />
        </>
      )}
      <circle cx="14" cy="88" r="2" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

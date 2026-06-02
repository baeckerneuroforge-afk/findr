import Link from "next/link";

/**
 * The findr. wordmark: lowercase "findr" + a small red dot (source brand mark,
 * #B00). Rendered in the body face (Hanken) — Fraunces is reserved for
 * headlines. Links home.
 */
export function Wordmark({
  className = "",
  size = "md",
  tone = "ink",
}: {
  className?: string;
  size?: "md" | "sm";
  /** "ink" = dark wordmark for light surfaces (header). "light" = white
   * wordmark for the dark footer anchor (Farbsystem). The red brand dot is
   * unchanged in both. */
  tone?: "ink" | "light";
}) {
  const text = size === "sm" ? "text-lg" : "text-xl";
  const light = tone === "light";
  const color = light ? "text-white" : "text-neutral-900";
  // On the dark anchor footer the brand red is brightened so the dot stays
  // perceptible (#bb0000 ≈ 2.3:1 on #2e1065; #ff5a5a ≈ 5:1) and the focus
  // ring-offset matches the anchor surface instead of flashing white.
  const ringOffset = light ? "focus-visible:ring-offset-anchor" : "";
  const dot = light ? "bg-[#ff5a5a]" : "bg-[#bb0000]";
  return (
    <Link
      href="/"
      aria-label="findr. — Startseite"
      className={`inline-flex items-end rounded font-semibold tracking-tight ${color} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 ${ringOffset} ${text} ${className}`}
    >
      <span>findr</span>
      <span
        aria-hidden
        className={`mb-[0.2em] ml-0.5 h-1.5 w-1.5 rounded-full ${dot}`}
      />
    </Link>
  );
}

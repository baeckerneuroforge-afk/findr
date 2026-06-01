import Link from "next/link";

/**
 * The findr. wordmark: lowercase "findr" + a small red dot (source brand mark,
 * #B00). Rendered in the body face (Hanken) — Fraunces is reserved for
 * headlines. Links home.
 */
export function Wordmark({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "md" | "sm";
}) {
  const text = size === "sm" ? "text-lg" : "text-xl";
  return (
    <Link
      href="/"
      aria-label="findr. — Startseite"
      className={`inline-flex items-end rounded font-semibold tracking-tight text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 ${text} ${className}`}
    >
      <span>findr</span>
      <span
        aria-hidden
        className="mb-[0.2em] ml-0.5 h-1.5 w-1.5 rounded-full bg-[#bb0000]"
      />
    </Link>
  );
}

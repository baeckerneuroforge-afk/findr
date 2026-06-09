import Link from "next/link";

/**
 * Die findr.-Wortmarke der Studio-Bühne: "findr" in Bricolage (Display-Stimme)
 * plus blinkender REC-Punkt (st-brand, studio.css) — der Punkt IST das
 * Markenzeichen: Aufnahme läuft. Links home.
 */
export function Wordmark({
  className = "",
  size = "md",
  tone = "ink",
}: {
  className?: string;
  size?: "md" | "sm";
  /** "ink" = dunkle Wortmarke für helle Flächen (Header). "light" = Creme
   * für den dunklen Studio-Footer. Der REC-Punkt bleibt in beiden rot. */
  tone?: "ink" | "light";
}) {
  const text = size === "sm" ? "text-lg" : "text-[22px]";
  const light = tone === "light";
  const ringOffset = light ? "focus-visible:ring-offset-anchor" : "";
  return (
    <Link
      href="/"
      aria-label="findr. — Startseite"
      className={`st-brand ${light ? "st-brand--light" : ""} rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 ${ringOffset} ${text} ${className}`}
    >
      <span>findr</span>
      <i aria-hidden />
    </Link>
  );
}

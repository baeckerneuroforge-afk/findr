import Link from "next/link";
import { KlymeoMark } from "@/components/shared/KlymeoMark";

/**
 * Die Klymeo-Wortmarke der Studio-Bühne: der Funken-Mark (KlymeoMark) plus
 * "Klymeo" in der Marketing-Display-Schrift (st-brand, studio.css) — Mark links,
 * Schriftzug rechts. Links home.
 */
export function Wordmark({
  className = "",
  size = "md",
  tone = "ink",
  href = "/",
}: {
  className?: string;
  size?: "md" | "sm";
  /** "ink" = dunkle Wortmarke für helle Flächen (Header). "light" = Creme
   * für den dunklen Studio-Footer. Der Funken-Mark bleibt in beiden indigo. */
  tone?: "ink" | "light";
  /** Home destination — locale-prefixed by the caller (/de, /en). */
  href?: string;
}) {
  const text = size === "sm" ? "text-lg" : "text-[22px]";
  const mark = size === "sm" ? "h-[18px] w-[18px]" : "h-[22px] w-[22px]";
  const light = tone === "light";
  const ringOffset = light ? "focus-visible:ring-offset-anchor" : "";
  return (
    <Link
      href={href}
      aria-label="Klymeo — Startseite"
      className={`inline-flex items-center gap-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 ${ringOffset} ${className}`}
    >
      <KlymeoMark tone={light ? "onDark" : "brand"} className={`shrink-0 ${mark}`} />
      <span
        className={`st-brand ${light ? "st-brand--light" : ""} ${text}`}
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 500,
          letterSpacing: "-0.04em",
        }}
      >
        Klymeo
      </span>
    </Link>
  );
}

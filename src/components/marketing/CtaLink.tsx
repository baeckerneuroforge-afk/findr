import Link from "next/link";
import type { ReactNode } from "react";

type CtaVariant = "primary" | "secondary" | "ghost";
type CtaSize = "md" | "lg";

const VARIANT: Record<CtaVariant, string> = {
  // REC-roter Pill-Button (st-btn-rec, studio.css) — der eine laute Akzent.
  primary: "st-btn st-btn-rec",
  // Tinten-Outline-Pill; auf dunklen Flächen (st-on-dark) automatisch Creme.
  secondary: "st-btn st-btn-ghost",
  ghost:
    "font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-500 hover:text-neutral-900 transition-colors",
};

const SIZE: Record<CtaSize, string> = {
  md: "h-11 px-6 text-sm",
  lg: "h-14 px-8 text-[16px]",
};

/**
 * Marketing CTA — Studio-Pills. Renders next/link for internal routes; falls
 * back to a plain <a target="_blank"> for external (http…) URLs. Füge die
 * Klasse `magnetic` hinzu, damit der Button dem Pointer leicht folgt
 * (StudioFx-Delegation, nur fine-pointer + motion).
 */
export function CtaLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: CtaVariant;
  size?: CtaSize;
  className?: string;
}) {
  const sizing = variant === "ghost" ? "" : SIZE[size];
  const cls = `inline-flex items-center justify-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 ${VARIANT[variant]} ${sizing} ${className}`;

  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

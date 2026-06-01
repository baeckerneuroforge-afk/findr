import Link from "next/link";
import type { ReactNode } from "react";

type CtaVariant = "primary" | "secondary" | "ghost";
type CtaSize = "md" | "lg";

const VARIANT: Record<CtaVariant, string> = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-700",
  secondary:
    "bg-white text-neutral-900 border border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50",
  ghost: "text-neutral-700 hover:text-primary-700",
};

const SIZE: Record<CtaSize, string> = {
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

/**
 * Marketing CTA. Renders next/link for internal routes; falls back to a plain
 * <a target="_blank"> for external (http…) URLs. 4px radius, on-brand violet.
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
  const cls = `inline-flex items-center justify-center gap-2 rounded font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 ${VARIANT[variant]} ${SIZE[size]} ${className}`;

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

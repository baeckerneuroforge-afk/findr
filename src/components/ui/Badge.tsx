import type { ReactNode } from "react";

export type BadgeVariant =
  | "default"
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "success";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default: "bg-neutral-100 text-neutral-700 border-neutral-200",
  low: "bg-success-50 text-success-700 border-success-500/30",
  medium: "bg-warning-50 text-warning-700 border-warning-500/30",
  high: "bg-orange-50 text-orange-700 border-orange-500/30",
  critical: "bg-danger-50 text-danger-700 border-danger-500/30",
  success: "bg-success-50 text-success-700 border-success-500/30",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-medium border ${VARIANT_STYLES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export default Badge;

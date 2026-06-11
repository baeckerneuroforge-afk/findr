import type { ReactNode } from "react";

interface StatCardProps {
  label: ReactNode;
  value: string | number;
  subtitle?: string;
  status?: "default" | "primary" | "warning" | "critical" | "success";
}

const STATUS_VALUE_STYLES: Record<NonNullable<StatCardProps["status"]>, string> = {
  default: "text-neutral-900",
  primary: "text-primary-700",
  warning: "text-warning-700",
  critical: "text-danger-700",
  success: "text-success-700",
};

export function StatCard({
  label,
  value,
  subtitle,
  status = "default",
}: StatCardProps) {
  return (
    <div className="bg-white border border-neutral-200 rounded-card shadow-card p-5">
      <div className="mb-2 flex items-center gap-1.5 text-caption font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`text-display tabular-nums ${STATUS_VALUE_STYLES[status]}`}>
        {value}
      </div>
      {subtitle && (
        <div className="mt-1 text-small text-neutral-500">{subtitle}</div>
      )}
    </div>
  );
}

export default StatCard;

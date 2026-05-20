interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  status?: "default" | "warning" | "critical" | "success";
}

const STATUS_VALUE_STYLES: Record<NonNullable<StatCardProps["status"]>, string> = {
  default: "text-neutral-900",
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
    <div className="bg-white border border-neutral-200 rounded-lg p-5">
      <div className="text-caption text-neutral-500 mb-2 uppercase tracking-wider font-medium">
        {label}
      </div>
      <div className={`text-display ${STATUS_VALUE_STYLES[status]}`}>
        {value}
      </div>
      {subtitle && (
        <div className="mt-1 text-small text-neutral-500">{subtitle}</div>
      )}
    </div>
  );
}

export default StatCard;

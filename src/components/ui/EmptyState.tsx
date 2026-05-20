import Link from "next/link";
import type { ReactNode } from "react";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: EmptyStateAction;
  variant?: "default" | "subtle";
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "default",
}: EmptyStateProps) {
  const container =
    variant === "default"
      ? "rounded-lg border border-dashed border-neutral-200 bg-white p-12 text-center"
      : "p-8 text-center";

  return (
    <div className={container}>
      {icon && (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
          {icon}
        </div>
      )}
      <h3 className="mt-4 text-h1 text-neutral-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-body text-neutral-500">
        {description}
      </p>
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className="mt-6 inline-flex h-8 items-center justify-center rounded-md bg-neutral-900 px-3 text-body-strong font-medium text-white transition-colors hover:bg-neutral-700"
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-6 inline-flex h-8 items-center justify-center rounded-md bg-neutral-900 px-3 text-body-strong font-medium text-white transition-colors hover:bg-neutral-700"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}

export default EmptyState;

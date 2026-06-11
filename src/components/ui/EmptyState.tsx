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
  cta?: { label: string; href: string };
  action?: EmptyStateAction;
  variant?: "default" | "subtle";
}

export function EmptyState({
  icon,
  title,
  description,
  cta,
  action,
  variant = "default",
}: EmptyStateProps) {
  const visibleAction = action ?? cta;
  const container =
    variant === "default"
      ? "rounded-card border border-dashed border-neutral-200 bg-white p-12 text-center"
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
      {visibleAction &&
        ("href" in visibleAction && visibleAction.href ? (
          <Link
            href={visibleAction.href}
            className="mt-6 inline-flex h-8 items-center justify-center rounded-md bg-primary-600 px-3 text-body-strong font-medium text-white transition-colors hover:bg-primary-700"
          >
            {visibleAction.label}
          </Link>
        ) : "onClick" in visibleAction && visibleAction.onClick ? (
          <button
            type="button"
            onClick={visibleAction.onClick}
            className="mt-6 inline-flex h-8 items-center justify-center rounded-md bg-primary-600 px-3 text-body-strong font-medium text-white transition-colors hover:bg-primary-700"
          >
            {visibleAction.label}
          </button>
        ) : null)}
    </div>
  );
}

export default EmptyState;

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
      ? "rounded-xl border border-dashed border-mist/15 bg-mist/5 p-12 text-center"
      : "p-8 text-center";

  return (
    <div className={container}>
      {icon && (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/10 text-violet-300">
          {icon}
        </div>
      )}
      <h3 className="mt-4 text-xl font-medium text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-mist">{description}</p>
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="mt-6 inline-block rounded-lg bg-violet-600 px-4 py-2 font-medium text-white transition-colors hover:bg-violet-700"
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-6 inline-block rounded-lg bg-violet-600 px-4 py-2 font-medium text-white transition-colors hover:bg-violet-700"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}

export default EmptyState;

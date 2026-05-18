import Link from "next/link";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  cta?: { label: string; href: string };
}

export default function EmptyState({
  icon,
  title,
  description,
  cta,
}: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-mist/15 bg-mist/5 p-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center text-mist">
        {icon}
      </div>
      <h3 className="mt-4 text-xl font-medium text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-mist">{description}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-6 inline-block rounded-lg bg-violet-600 px-4 py-2 font-medium text-white transition-colors hover:bg-violet-700"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

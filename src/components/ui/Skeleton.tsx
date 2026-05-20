export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-neutral-100 ${className}`} />;
}

export function DealRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-neutral-100 p-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="ml-auto h-5 w-32" />
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-6 w-16 rounded-md" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <Skeleton className="mb-3 h-3 w-20" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <Skeleton className="mb-2 h-4 w-32" />
      <Skeleton className="mb-6 h-3 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

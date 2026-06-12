import { StatCardSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function HealthLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-3 h-9 w-56" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="space-y-4">
        <div>
          <Skeleton className="mb-2 h-6 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <div className="rounded-lg border border-neutral-200 bg-card p-5">
          <Skeleton className="mb-2 h-3 w-64" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-card p-6">
        <Skeleton className="mb-2 h-6 w-40" />
        <Skeleton className="mb-6 h-4 w-96 max-w-full" />
        <div className="space-y-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Skeleton className="mb-2 h-6 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Skeleton className="mb-2 h-6 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="rounded-lg border border-neutral-200 bg-card">
          <div className="border-b border-neutral-100 p-4">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-auto h-4 w-24" />
            </div>
          </div>
          <div className="space-y-0">
            <div className="border-b border-neutral-100 p-4">
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="border-b border-neutral-100 p-4">
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="border-b border-neutral-100 p-4">
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

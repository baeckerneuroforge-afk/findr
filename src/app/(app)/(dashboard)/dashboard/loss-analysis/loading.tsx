import { StatCardSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function LossAnalysisLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-3 h-9 w-56" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <Skeleton className="mb-4 h-6 w-48" />
        <Skeleton className="mb-4 h-5 w-80 max-w-full" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Skeleton className="mb-1 h-6 w-56" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Skeleton className="mb-1 h-6 w-48" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white">
          <div className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

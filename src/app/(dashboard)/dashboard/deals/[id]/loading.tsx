import { ChartSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function DealDetailLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-6 h-5 w-56" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Skeleton className="mb-3 h-9 w-80 max-w-full" />
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      <ChartSkeleton />

      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <Skeleton className="mb-4 h-8 w-28" />
        <Skeleton className="mb-3 h-4 w-64" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>

      <div>
        <Skeleton className="mb-4 h-7 w-36" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    </div>
  );
}

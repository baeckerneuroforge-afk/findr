import { Skeleton } from "@/components/ui/Skeleton";

// Instant route-level skeleton for the data-sources page (header → grid of
// integration source cards). Bridges the parallel integration-status reads.
export default function DataSourcesLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-3 h-9 w-56" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-neutral-200 bg-card p-6"
          >
            <div className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="flex-1">
                <Skeleton className="mb-2 h-5 w-32" />
                <Skeleton className="mb-1 h-4 w-full max-w-sm" />
                <Skeleton className="h-4 w-2/3 max-w-xs" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

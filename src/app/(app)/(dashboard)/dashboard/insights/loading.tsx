import { Skeleton } from "@/components/ui/Skeleton";

export default function InsightsLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-3 h-9 w-48" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="space-y-4">
        <div>
          <div className="inline-flex gap-2">
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
          <Skeleton className="mt-2 h-5 w-80 max-w-full" />
        </div>

        <div className="rounded-lg border border-neutral-200 bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <Skeleton className="mb-1 h-6 w-32" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
          </div>

          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-md" />
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-16 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

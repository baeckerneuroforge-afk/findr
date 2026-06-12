import { Skeleton } from "@/components/ui/Skeleton";

export default function MarketResearchDetailLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-6 h-5 w-56" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-6 w-16 rounded-md" />
            </div>
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-card p-5">
        <Skeleton className="mb-4 h-6 w-32" />
        <Skeleton className="mb-4 h-16 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-card p-5">
        <Skeleton className="mb-3 h-6 w-40" />
        <Skeleton className="mb-3 h-4 w-64" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      <div className="space-y-3">
        <div>
          <Skeleton className="mb-2 h-6 w-32" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>

      <div className="space-y-4">
        <div>
          <Skeleton className="mb-2 h-6 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="rounded-lg border border-neutral-200 bg-card">
          <div className="flex gap-4 border-b border-neutral-200 p-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-0">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

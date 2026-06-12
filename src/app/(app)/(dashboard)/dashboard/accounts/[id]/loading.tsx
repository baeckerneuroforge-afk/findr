import { ChartSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function AccountDetailLoading() {
  return (
    <div className="space-y-8">
      {/* Breadcrumb + header grouped (mirrors the deals/[id] skeleton). The
          page uses mb-6 on the breadcrumb and mb-8 on the header block, so
          grouping keeps the breadcrumb→title gap at 24px while space-y-8
          handles the 32px gap to the first section below. */}
      <div>
        <Skeleton className="mb-6 h-5 w-56" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-7 w-24 rounded-md" />
            </div>
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
        </div>
      </div>

      {/* AccountHealthPanel: Card with h2 + badge + textarea + button + chart */}
      <div className="space-y-6">
        <div className="rounded-lg border border-neutral-200 bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
          <Skeleton className="mb-4 h-4 w-64" />
          <Skeleton className="mb-4 h-24 w-full rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>

        <ChartSkeleton />

        <div className="rounded-lg border border-neutral-200 bg-card p-6">
          <Skeleton className="mb-3 h-4 w-60" />
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      </div>

      {/* SavePlayPanel (conditional, so we include it as present) */}
      <div className="rounded-lg border border-neutral-200 bg-card p-6">
        <Skeleton className="mb-4 h-7 w-48" />
        <div className="space-y-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
        </div>
      </div>

      {/* AccountCheckinPanel */}
      <div className="rounded-lg border border-neutral-200 bg-card p-6">
        <Skeleton className="mb-4 h-7 w-52" />
        <div className="space-y-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      </div>

      {/* Product Discovery: h2 + call cards */}
      <div>
        <Skeleton className="mb-4 h-7 w-44" />
        <div className="space-y-6">
          <div className="rounded-lg border border-neutral-200 bg-card p-4">
            <Skeleton className="mb-3 h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="rounded-lg border border-neutral-200 bg-card p-4">
            <Skeleton className="mb-3 h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>

      {/* AccountMasterCard */}
      <div className="rounded-lg border border-neutral-200 bg-card p-6">
        <Skeleton className="mb-4 h-7 w-40" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

import {
  DealRowSkeleton,
  Skeleton,
  StatCardSkeleton,
} from "@/components/ui/Skeleton";

// Instant route-level skeleton for the dashboard landing page. Mirrors the
// page's shapes loosely (header → stat row → table card) using the shared
// skeleton primitives (same idiom as forecast/loading.tsx); shown only while
// the server component awaits its data, so it stays generic.
export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-3 h-9 w-48" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-card">
        <Skeleton className="m-5 h-5 w-40" />
        <DealRowSkeleton />
        <DealRowSkeleton />
        <DealRowSkeleton />
      </div>
    </div>
  );
}

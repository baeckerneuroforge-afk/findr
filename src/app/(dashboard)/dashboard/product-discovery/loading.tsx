import { StatCardSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function ProductDiscoveryLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-3 h-9 w-56" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <section className="space-y-4">
        <div>
          <Skeleton className="mb-3 h-7 w-48" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <Skeleton className="mb-3 h-7 w-48" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <Skeleton className="mb-3 h-7 w-44" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <Skeleton className="mb-3 h-7 w-52" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white">
          <Skeleton className="m-5 h-5 w-32" />
          <div className="space-y-3 p-5 pt-0">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </section>
    </div>
  );
}

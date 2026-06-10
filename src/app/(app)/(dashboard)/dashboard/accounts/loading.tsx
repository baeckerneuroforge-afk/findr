import { StatCardSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function AccountsLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-3 h-9 w-40" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <Skeleton className="h-10 w-full rounded-lg" />

      <Skeleton className="h-32 w-full rounded-lg" />

      <div className="space-y-6">
        <div>
          <Skeleton className="mb-3 h-6 w-48" />
          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <div className="border-b border-neutral-100 p-4 flex gap-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="space-y-0">
              <div className="border-b border-neutral-100 p-4 flex gap-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="border-b border-neutral-100 p-4 flex gap-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="border-b border-neutral-100 p-4 flex gap-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          </div>
        </div>

        <div>
          <Skeleton className="mb-3 h-6 w-36" />
          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <div className="border-b border-neutral-100 p-4 flex gap-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="space-y-0">
              <div className="border-b border-neutral-100 p-4 flex gap-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="border-b border-neutral-100 p-4 flex gap-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

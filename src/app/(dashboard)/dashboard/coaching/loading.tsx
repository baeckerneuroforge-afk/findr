import { StatCardSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function CoachingLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-3 h-9 w-52" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-44 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/Skeleton";

export default function PersonasLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-6 h-5 w-44" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Skeleton className="mb-3 h-9 w-64 max-w-full" />
            <Skeleton className="h-5 w-80 max-w-full" />
            <Skeleton className="mt-2 h-5 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <Skeleton className="mb-2 h-7 w-40" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      </section>
    </div>
  );
}

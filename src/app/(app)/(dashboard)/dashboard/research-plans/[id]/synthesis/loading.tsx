import { Skeleton } from "@/components/ui/Skeleton";

export default function SynthesisLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-6 h-5 w-56" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Skeleton className="mb-3 h-9 w-80 max-w-full" />
            <Skeleton className="h-5 w-96 max-w-full" />
            <Skeleton className="mt-2 h-5 w-full max-w-md" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-card p-6">
        <Skeleton className="mb-4 h-6 w-32" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>

      <section className="space-y-4">
        <div>
          <Skeleton className="mb-2 h-7 w-48" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <Skeleton className="mb-2 h-7 w-40" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-card p-6">
            <Skeleton className="mb-3 h-5 w-96 max-w-full" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-card p-6">
            <Skeleton className="mb-3 h-5 w-96 max-w-full" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import { Skeleton } from "@/components/ui/Skeleton";

export default function ResearchPlanDetailLoading() {
  return (
    <div className="space-y-8">
      {/* Back-link */}
      <div>
        <Skeleton className="mb-6 h-5 w-56" />
      </div>

      {/* Header */}
      <div>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-80 max-w-full" />
            <Skeleton className="h-7 w-20 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      {/* Objective Card */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <Skeleton className="mb-4 h-7 w-32" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <Skeleton className="mb-2 h-3 w-32" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div>
            <Skeleton className="mb-2 h-3 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>

      {/* Topics Section */}
      <section className="space-y-4">
        <div>
          <Skeleton className="mb-2 h-7 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <ul className="space-y-3">
          <li>
            <div className="rounded-lg border border-neutral-200 bg-white p-6">
              <Skeleton className="mb-3 h-3 w-20" />
              <Skeleton className="mb-3 h-6 w-64" />
              <Skeleton className="mb-3 h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </li>
          <li>
            <div className="rounded-lg border border-neutral-200 bg-white p-6">
              <Skeleton className="mb-3 h-3 w-20" />
              <Skeleton className="mb-3 h-6 w-56" />
              <Skeleton className="mb-3 h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </li>
        </ul>
      </section>

      {/* Participants Section */}
      <section className="space-y-4">
        <div>
          <Skeleton className="mb-2 h-7 w-48" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 p-5">
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </section>

      {/* Add Participant Form */}
      <section className="space-y-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-6">
          <Skeleton className="mb-4 h-6 w-44" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </section>
    </div>
  );
}

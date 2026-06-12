import { Skeleton } from "@/components/ui/Skeleton";

/** Sofort-Skeleton für /settings(/­*) — ohne loading.tsx wirkte der
 *  Sidebar-Klick „tot", bis Clerk + Org-Reads geantwortet hatten (Konsole-v5
 *  Performance-Runde). Rendert im Page-Slot unterhalb des Settings-Layouts. */
export default function SettingsLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-3 h-9 w-56" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>

      <div className="rounded-card border border-neutral-200 bg-card shadow-card">
        <div className="space-y-3 p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      </div>

      <div className="rounded-card border border-neutral-200 bg-card shadow-card">
        <div className="space-y-3 p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/Skeleton";

/** Sofort-Skeleton für den Teilnehmer-Pool — eigene Datei, damit auch der
 *  In-Tree-Wechsel (z. B. von der Plan-Liste) sofort reagiert und nicht nur
 *  der Cross-Tree-Einstieg über das research-plans-Loading (Konsole-v5
 *  Performance-Runde). Spiegelt die Listen-Skeleton-Form der Studien-Seite. */
export default function ParticipantPoolLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="mb-3 h-9 w-64" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      <div className="rounded-card border border-neutral-200 bg-card shadow-card">
        <div className="space-y-3 p-5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

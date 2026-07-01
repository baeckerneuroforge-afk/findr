import "server-only";

/**
 * Kurzlebiges In-Memory-Memo für den Health-DB-Check (Security-Sweep
 * 2026-07-01, NIEDRIG): /api/health ist öffentlich und ohne Rate-Limit —
 * vorher löste JEDER anonyme GET eine Postgres-Query aus (billiger
 * Amplifikations-Hebel). 10s-TTL pro warmer Instanz: Uptime-Monitore
 * (typisch 30–60s-Intervall) treffen weiter frische Checks; ein Flood
 * bezahlt ab dem zweiten Hit nur noch den Funktions-Invoke, nicht die DB.
 * Fluid Compute teilt die Instanz über parallele Requests → das Memo greift
 * auch unter Last. Eigenes Modul (nicht route.ts), weil Next aus route.ts
 * nur HTTP-Handler + Route-Config-Exports erlaubt.
 */
const DB_CHECK_TTL_MS = 10_000;

let lastDbCheck: { at: number; ok: boolean } | null = null;

export function readFreshDbCheck(): boolean | null {
  if (lastDbCheck && Date.now() - lastDbCheck.at < DB_CHECK_TTL_MS) {
    return lastDbCheck.ok;
  }
  return null;
}

export function storeDbCheck(ok: boolean): void {
  lastDbCheck = { at: Date.now(), ok };
}

/** Nur für Tests: Memo zurücksetzen (Vitest teilt die Modulinstanz). */
export function __resetHealthDbMemoForTests(): void {
  lastDbCheck = null;
}

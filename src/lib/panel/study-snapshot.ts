/**
 * Pure Parse-/Coerce-Helfer für den Panel-Sync (E5) — bewusst ohne
 * "server-only", damit Tests sie direkt importieren können (Muster von
 * src/lib/research/panel.ts). Zwei Verwendungsstellen:
 *
 *  1. prolific.ts parst damit die API-Antworten von
 *     GET /studies/{id}/ und GET /studies/{id}/submissions/counts/
 *     (Endpoints + Felder verifiziert gegen docs.prolific.com,
 *     api-reference/studies/get-study.md bzw.
 *     count-study-submissions-by-status.md, Stand 2026-06-11).
 *  2. studies.ts re-validiert damit das submission_counts-jsonb beim Lesen
 *     aus der DB (Trust-Boundary: jsonb ist untypisiert).
 *
 * Die Counts kommen als flaches Objekt mit Status-Buckets als Keys
 * ("ACTIVE", "APPROVED", "AWAITING REVIEW", …, "TOTAL") und Zahlen als
 * Werten. Wir übernehmen NUR string→endliche-Zahl-Einträge und kappen die
 * Key-Länge — das Vokabular gehört dem Provider und darf wachsen, ohne dass
 * findr bricht.
 */

export interface PanelStudySnapshot {
  /** Provider-Status (Prolific: UNPUBLISHED, SCHEDULED, PUBLISHING, ACTIVE,
   *  "AWAITING REVIEW", PAUSED, COMPLETED) — bewusst freier string, das
   *  Vokabular gehört dem Provider. */
  status: string;
}

const MAX_COUNT_KEYS = 50;
const MAX_COUNT_KEY_LENGTH = 40;

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/** Antwort von GET /studies/{id}/ → Snapshot. null, wenn kein brauchbarer
 *  status drinsteht (kaputte/unerwartete Antwort). */
export function parseProlificStudySnapshot(
  json: unknown,
): PanelStudySnapshot | null {
  if (!json || typeof json !== "object") return null;
  const status = getString((json as Record<string, unknown>).status);
  if (!status) return null;
  return { status };
}

/** Flaches Status→Anzahl-Objekt validieren (API-Antwort ODER jsonb aus der
 *  DB). Nicht-Objekte → null; nicht-endliche/negative Werte und überlange
 *  Keys werden verworfen statt die ganze Antwort zu reißen. */
export function coerceSubmissionCounts(
  value: unknown,
): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const counts: Record<string, number> = {};
  let kept = 0;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (kept >= MAX_COUNT_KEYS) break;
    if (key.length === 0 || key.length > MAX_COUNT_KEY_LENGTH) continue;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) continue;
    counts[key] = raw;
    kept++;
  }
  return counts;
}

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

// ── E6: Kosten ────────────────────────────────────────────────────────────────
// Endpoints verifiziert gegen docs.prolific.com (api-reference/studies/
// calculate-study-cost.md + get-study-cost.md, 2026-06-11):
//   POST /study-cost-calculator/          → { total_cost } in Cents, inkl.
//     VAT + Fees aus den ACCOUNT-Einstellungen (nichts hartkodiert),
//     Account-Währung, ohne Währungscode in der Antwort.
//   GET /studies/{id}/cost/?is_projected= → StudyTotalCost: { rewards:
//     {rewards|fees|tax: {amount, currency}}, bonuses: {…} }, amount in
//     Subcurrency ("£1 will return 100").

function getFiniteNonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

/** Antwort von POST /study-cost-calculator/ → Gesamtkosten in Cents. */
export function parseProlificCalculatedCost(json: unknown): number | null {
  if (!json || typeof json !== "object") return null;
  const total = getFiniteNonNegative(
    (json as Record<string, unknown>).total_cost,
  );
  return total === null ? null : Math.round(total);
}

export interface PanelStudyCost {
  /** Summe aller Komponenten (rewards+fees+tax, inkl. Bonuses) in Subcurrency. */
  totalCents: number;
  /** Währungscode aus der Antwort (erste gefundene), null wenn keiner dabei. */
  currency: string | null;
}

/** Antwort von GET /studies/{id}/cost/ → Gesamtsumme + Währung. Fehlende
 *  Sektionen (z. B. bonuses bei Drafts) zählen als 0; ohne eine einzige
 *  parsebare Komponente → null. */
export function parseProlificStudyCost(json: unknown): PanelStudyCost | null {
  if (!json || typeof json !== "object") return null;
  let total = 0;
  let found = false;
  let currency: string | null = null;

  for (const sectionKey of ["rewards", "bonuses"]) {
    const section = (json as Record<string, unknown>)[sectionKey];
    if (!section || typeof section !== "object") continue;
    for (const partKey of ["rewards", "fees", "tax"]) {
      const part = (section as Record<string, unknown>)[partKey];
      if (!part || typeof part !== "object") continue;
      const amount = getFiniteNonNegative(
        (part as Record<string, unknown>).amount,
      );
      if (amount === null) continue;
      total += amount;
      found = true;
      if (!currency) {
        const cur = (part as Record<string, unknown>).currency;
        if (typeof cur === "string" && cur.trim().length > 0 && cur.length <= 8) {
          currency = cur.trim();
        }
      }
    }
  }

  if (!found) return null;
  return { totalCents: Math.round(total), currency };
}

// ── E7: Fehler-Envelope ───────────────────────────────────────────────────────
// Prolific-Fehler kommen dokumentiert als { error: { status, error_code,
// title, detail, additional_information, traceback } } (verifiziert gegen
// api-reference/studies/publish-study.md, 2026-06-11). Eine spezifische
// Insufficient-Funds-Form ist NICHT dokumentiert — deshalb reichen wir
// title/detail wörtlich an die UI durch, statt Fehlercodes zu raten.

const MAX_PROVIDER_MESSAGE_LENGTH = 500;

function asMessageString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (Array.isArray(value)) {
    const parts = value
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
    return parts.length > 0 ? parts.join("; ") : null;
  }
  return null;
}

/** { error: { title, detail } } → menschenlesbare Provider-Meldung ("title:
 *  detail", gekappt) — oder null, wenn nichts Brauchbares drinsteht. */
export function parseProlificErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const envelope = (json as Record<string, unknown>).error;
  if (!envelope || typeof envelope !== "object") return null;
  const title = asMessageString((envelope as Record<string, unknown>).title);
  const detail = asMessageString((envelope as Record<string, unknown>).detail);
  const combined =
    title && detail ? `${title}: ${detail}` : (title ?? detail);
  if (!combined) return null;
  return combined.length > MAX_PROVIDER_MESSAGE_LENGTH
    ? `${combined.slice(0, MAX_PROVIDER_MESSAGE_LENGTH)}…`
    : combined;
}

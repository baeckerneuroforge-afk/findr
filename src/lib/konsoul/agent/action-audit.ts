import "server-only";

import type { Json } from "@/types/database";
import {
  createResearchSupabase,
  type KonsoulActionType,
  type KonsoulActionStatus,
} from "@/lib/research/db";

/**
 * Konsoul P3.0 — ACTION AUDIT writer (Design-Doc §3, Review-Auflage 1).
 *
 * Schreibt org-/portfolio-seitige METADATEN über jeden Aktions-Vorschlag, den
 * Konsoul macht, und dessen Ausgang (accepted/ignored) in die additive Leaf-
 * Tabelle `konsoul_action_log`. Konsoul FÜHRT NIE SELBST AUS — die Ausführung
 * lebt im Frontend-Confirm-Klick gegen die bestehenden org-scoped Endpunkte.
 * Dieses Modul protokolliert nur.
 *
 * ─── HARTE LEITPLANKEN ──────────────────────────────────────────────────────
 * - NUR METADATEN. Es gibt strukturell KEINE Stelle, an der hier Freitext /
 *   rationale / answer / Modell-Prosa / Affekt-Label in eine Zeile gelangen
 *   kann: die Tabelle hat keine solche Spalte, und `counts` wird hart auf eine
 *   Zahlen-Key-Whitelist (COUNTS_KEY_WHITELIST) gefiltert (numerische Werte,
 *   String-/Objekt-Werte werden verworfen). Das deckt sich mit der L8-„kein-
 *   Affekt"-Regel und der Konsoul-PII-Negativregel.
 * - ORG-AUTORITATIV. `orgId` kommt vom Aufrufer (Engine-Closure bzw.
 *   requireOrgIdOrError-authentifizierte Route), NIE vom Modell/Client. Jeder
 *   Insert/Update ist per `.eq('org_id', orgId)` org-scoped.
 * - FAIL-OPEN gegen den Hauptpfad: ein Audit-Schreibfehler darf weder einen
 *   Vorschlag noch einen erfolgreichen Confirm kippen. ABER der Fehler wird
 *   geloggt (Sentry falls vorhanden, sonst console.error) — KEINE stille Audit-
 *   Lücke. `logProposed` läuft VOR der Ausführung; `logDecision` danach.
 */

// ── counts-Key-Whitelist (Datensparsamkeit, fail-closed) ─────────────────────

/**
 * Die EINZIGEN Zahlen-Keys, die `counts` tragen darf. Jeder andere Key wird
 * verworfen; jeder nicht-endlich-numerische Wert wird verworfen. So kann nie
 * ungerahmter Modell-Output, Prosa oder ein Affekt-Label in die Spalte driften.
 *
 * - based_on_count:    Anzahl Interviews, auf denen eine Synthese/Personas fußt
 * - completed_sessions: abgeschlossene Interviews der Zielstudie
 * - affected_studies:  Anzahl betroffener Studien (Cross-Study-Signale)
 * - pool_size:         Pool-Größe, falls ein Signal sie trug
 */
export const COUNTS_KEY_WHITELIST = [
  "based_on_count",
  "completed_sessions",
  "affected_studies",
  "pool_size",
] as const;

export type KonsoulCountsKey = (typeof COUNTS_KEY_WHITELIST)[number];

const COUNTS_KEY_SET = new Set<string>(COUNTS_KEY_WHITELIST);

/**
 * Pure: behält NUR whitelisted Keys mit endlich-numerischem Wert. Alles andere
 * (fremde Keys, Strings, Objekte, NaN/Infinity) fällt weg. Deterministisch,
 * kein I/O — der Audit-PII-Negativtest kann hier direkt prüfen, dass keine
 * Prosa durchkommt.
 */
export function sanitizeCounts(
  counts: Record<string, unknown> | undefined | null,
): Record<KonsoulCountsKey, number> {
  const out: Record<string, number> = {};
  if (!counts || typeof counts !== "object") return out;
  for (const [key, value] of Object.entries(counts)) {
    if (!COUNTS_KEY_SET.has(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return out;
}

// ── Fehler-Sink (fail-open, aber NIE stumm) ──────────────────────────────────

/**
 * Loggt einen Audit-Schreibfehler. Versucht Sentry (falls als optionale
 * Dependency vorhanden), fällt sonst auf console.error zurück (etabliertes
 * Muster der research-Libs). Wirft NIE — der Hauptpfad bleibt unberührt.
 */
function reportAuditFailure(context: string, err: unknown): void {
  // Sentry ist im Projekt aktuell keine Dependency; sobald es eingeführt wird,
  // greift dieser Pfad automatisch (dynamischer require, kein harter Import,
  // damit der Build ohne Sentry nicht bricht). Bis dahin: console.error.
  try {
    const g = globalThis as { Sentry?: { captureException?: (e: unknown) => void } };
    if (g.Sentry?.captureException) {
      g.Sentry.captureException(err);
    }
  } catch {
    // Sentry-Pfad selbst darf nie den Logger werfen lassen.
  }
  console.error(`[konsoul-action-audit] ${context}:`, err);
}

// ── Schreib-API ──────────────────────────────────────────────────────────────

export interface LogProposedInput {
  /** org-autoritativ (Engine-Closure / authentifizierte Route), NIE vom Modell. */
  orgId: string;
  /** Eine der GENAU VIER erlaubten Aktionen (Tabellen-CHECK ist der Backstop). */
  actionType: KonsoulActionType;
  /** Zielstudie, falls vorhanden (fehlt bei create_study_draft). */
  planId?: string | null;
  /** Klartext-Modell-Bezeichner (z. B. 'claude-opus-4-8'), KEIN Modell-Output. */
  model?: string | null;
  /** Prompt-/Korpus-Version, KEIN Modell-Output. */
  modelVersion?: string | null;
  /** Zahlen, die das Signal trugen — hart auf COUNTS_KEY_WHITELIST gefiltert. */
  counts?: Record<string, unknown> | null;
}

export interface LogProposedResult {
  /** Audit-Zeilen-ID, falls der Insert gelang — für die spätere Entscheidung.
   *  null bei fail-open (Schreibfehler/fehlende Tabelle): der Hauptpfad läuft
   *  weiter, logDecision wird dann zum No-op. */
  auditId: string | null;
}

/**
 * Audit-Schreibung #1 — beim VORSCHLAG, VOR jeder Ausführung. Status='proposed'.
 * Fail-open: bei Fehler wird geloggt und `{ auditId: null }` zurückgegeben; der
 * Aufrufer fährt unbeeinflusst fort.
 */
export async function logProposed(
  input: LogProposedInput,
): Promise<LogProposedResult> {
  try {
    const supabase = createResearchSupabase();
    const { data, error } = await supabase
      .from("konsoul_action_log")
      .insert({
        org_id: input.orgId,
        plan_id: input.planId ?? null,
        action_type: input.actionType,
        model: input.model ?? null,
        model_version: input.modelVersion ?? null,
        counts: sanitizeCounts(input.counts) as unknown as Json,
        status: "proposed",
      })
      .select("id")
      .single();

    if (error || !data) {
      reportAuditFailure("logProposed insert failed", error ?? "no row returned");
      return { auditId: null };
    }
    return { auditId: data.id };
  } catch (err) {
    reportAuditFailure("logProposed threw", err);
    return { auditId: null };
  }
}

export interface LogDecisionInput {
  /** Die von logProposed gelieferte Audit-Zeilen-ID. null ⇒ No-op (fail-open). */
  auditId: string | null;
  /** org-autoritativ — der Update ist zusätzlich per .eq('org_id', orgId) gescoped. */
  orgId: string;
  /** 'accepted' (Confirm-Erfolg) oder 'ignored' (Verwerfen/Dismiss). */
  status: Extract<KonsoulActionStatus, "accepted" | "ignored">;
}

/**
 * Audit-Schreibung #2 — beim CONFIRM/DISMISS, NACH dem (Confirm-)Ausgang.
 * Setzt status + decided_at (Server-Clock). Org-scoped Update. Fail-open: bei
 * fehlender auditId (vorheriger Insert-Fehler) oder Schreibfehler wird geloggt
 * und still weitergefahren — ein erfolgreicher Confirm wird NIE gekippt.
 */
export async function logDecision(input: LogDecisionInput): Promise<void> {
  if (!input.auditId) return; // logProposed schlug fehl → nichts zu aktualisieren.
  try {
    const supabase = createResearchSupabase();
    const { error } = await supabase
      .from("konsoul_action_log")
      .update({
        status: input.status,
        decided_at: new Date().toISOString(),
      })
      .eq("id", input.auditId)
      .eq("org_id", input.orgId);

    if (error) {
      reportAuditFailure("logDecision update failed", error);
    }
  } catch (err) {
    reportAuditFailure("logDecision threw", err);
  }
}

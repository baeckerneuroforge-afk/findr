import "server-only";

import type { Json } from "@/types/database";
import {
  createResearchSupabase,
  type KonsoulMetricEvent,
} from "@/lib/research/db";

/**
 * Konsoul P5 — ORG-SIDE TELEMETRY writer (Roadmap P5, Telemetrie/Erfolgsmetriken).
 *
 * Schreibt org-seitige NUTZUNGS-Metadaten in die additive Leaf-Tabelle
 * `konsoul_metrics`: WELCHES Event (Inline-Frage gestellt / Antwort gezeigt /
 * Thread gespeichert / Thread fortgesetzt) und ein eng-whitelisteter Zahlen-jsonb
 * (z. B. {grounded:1} / {turn_count:3}). So zählt ein Dashboard „N ⌘K-Fragen,
 * davon X geerdet" — ohne je Frage-/Antwort-TEXT zu speichern.
 *
 * ─── HARTE LEITPLANKEN (wie action-audit.ts) ────────────────────────────────
 * - NUR METADATEN. Die Tabelle hat KEINE Text-Spalte; `counts` wird hart auf
 *   COUNTS_KEY_WHITELIST gefiltert (nur endlich-numerische Werte). Kein Freitext/
 *   Affekt/Pro-Person-Label kann driften (export_organization_data dumpt jede
 *   Spalte → das wäre sonst ein PII-Leak).
 * - ORG-AUTORITATIV. `orgId` kommt vom Aufrufer (requireOrgIdOrError-Route), NIE
 *   vom Client/Modell.
 * - FAIL-OPEN. Ein Metrics-Schreibfehler darf den Hauptpfad (die Antwort) NIE
 *   kippen; er wird geloggt, aber nie geworfen.
 */

/** Die EINZIGEN Zahlen-Keys, die `counts` tragen darf — Antwort-Art-Zähler +
 *  Turn-Zähler. Jeder andere Key / nicht-numerische Wert fällt weg. */
export const METRIC_COUNTS_WHITELIST = [
  "grounded",
  "interpretation",
  "guidance",
  "refusal",
  "proposal",
  "turn_count",
] as const;

export type KonsoulMetricCountsKey = (typeof METRIC_COUNTS_WHITELIST)[number];

const METRIC_COUNTS_SET = new Set<string>(METRIC_COUNTS_WHITELIST);

/** Pure: behält NUR whitelisted Keys mit nicht-negativem GANZZAHL-Wert (ein
 *  Zähler ist nie negativ oder gebrochen — so kann ein bösartiger/fehlerhafter
 *  Client-Body kein Aggregat verfälschen). */
export function sanitizeMetricCounts(
  counts: Record<string, unknown> | undefined | null,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!counts || typeof counts !== "object") return out;
  for (const [key, value] of Object.entries(counts)) {
    if (!METRIC_COUNTS_SET.has(key)) continue;
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
      out[key] = value;
    }
  }
  return out;
}

function reportMetricFailure(context: string, err: unknown): void {
  try {
    const g = globalThis as {
      Sentry?: { captureException?: (e: unknown) => void };
    };
    if (g.Sentry?.captureException) g.Sentry.captureException(err);
  } catch {
    // never let the logger throw
  }
  console.error(`[konsoul-metrics] ${context}:`, err);
}

export interface LogMetricInput {
  /** org-autoritativ (authentifizierte Route), NIE vom Client. */
  orgId: string;
  event: KonsoulMetricEvent;
  /** Zahlen-Metadaten — hart auf METRIC_COUNTS_WHITELIST gefiltert. */
  counts?: Record<string, unknown> | null;
}

/**
 * Schreibt EINE Metrics-Zeile. Fail-open: bei Fehler wird geloggt und still
 * weitergefahren (gibt nichts zurück). occurred_at ist server-gestempelt.
 */
export async function logKonsoulMetric(input: LogMetricInput): Promise<void> {
  try {
    const supabase = createResearchSupabase();
    const { error } = await supabase.from("konsoul_metrics").insert({
      org_id: input.orgId,
      event: input.event,
      counts: sanitizeMetricCounts(input.counts) as unknown as Json,
    });
    if (error) reportMetricFailure("insert failed", error);
  } catch (err) {
    reportMetricFailure("threw", err);
  }
}

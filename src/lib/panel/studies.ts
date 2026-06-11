import "server-only";

import {
  createResearchSupabase,
  type PanelStudyRow,
} from "@/lib/research/db";
import type { Json } from "@/types/database";
import type { PanelProviderKey } from "./providers";
import { coerceSubmissionCounts } from "./study-snapshot";

/**
 * Panel-E4 — persistierte Provider-Studien (panel_studies).
 *
 * Schreib- und Lesepfad sind bewusst FAIL-OPEN (null statt throw):
 *  - Der Schreibpfad hängt hinter einem bereits ERFOLGREICHEN Prolific-Call —
 *    eine fehlgeschlagene Persistenz darf den angelegten Draft nicht als
 *    Fehler maskieren (der Nutzer würde erneut klicken ⇒ exakt das
 *    Doppel-Draft-Risiko, das E4 schließt). Stattdessen console.error +
 *    study:null in der Antwort.
 *  - Der Lesepfad läuft auf den Detailseiten vor angewandter Migration ins
 *    Leere (relation does not exist) — null lässt die Seiten exakt wie vor
 *    E4 rendern. Gleiches Muster wie panel_context (Code deploybar vor
 *    Migration).
 */

export interface PanelStudySummary {
  id: string;
  provider: PanelProviderKey;
  providerStudyId: string;
  status: string;
  /** Provider-Status-Buckets → Anzahl (E5-Sync); null = nie synchronisiert.
   *  Beim Lesen re-validiert (jsonb ist untypisiert). */
  submissionCounts: Record<string, number> | null;
  totalCostCents: number | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

function toSummary(row: PanelStudyRow): PanelStudySummary {
  return {
    id: row.id,
    provider: row.provider,
    providerStudyId: row.provider_study_id,
    status: row.status,
    submissionCounts: coerceSubmissionCounts(row.submission_counts),
    totalCostCents: row.total_cost_cents,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
  };
}

/**
 * Draft-Zeile anlegen. Upsert auf dem Unique-Key (org, provider,
 * provider_study_id), damit ein Retry mit derselben Studien-ID idempotent
 * bleibt statt an 23505 zu scheitern; jede NEUE Prolific-Studie hat eine
 * neue ID und wird eine eigene Zeile.
 */
export async function recordPanelStudyDraft(params: {
  orgId: string;
  planId: string;
  provider: PanelProviderKey;
  providerStudyId: string;
  status: string;
  draftInput: Record<string, unknown>;
}): Promise<PanelStudySummary | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("panel_studies")
    .upsert(
      {
        org_id: params.orgId,
        plan_id: params.planId,
        provider: params.provider,
        provider_study_id: params.providerStudyId,
        status: params.status,
        // Record<string, unknown> → Json: der Aufrufer reicht ein reines
        // Daten-Objekt (Draft-Input, nur strings/numbers); TS kann das ohne
        // Index-Signatur nicht beweisen — Standard-Cast an der einen
        // Schreibstelle.
        draft_input: params.draftInput as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,provider,provider_study_id" },
    )
    .select("*")
    .maybeSingle();
  if (error || !data) {
    console.error(
      `recordPanelStudyDraft failed for plan ${params.planId} (study ${params.providerStudyId}):`,
      error?.message ?? "no row returned",
    );
    return null;
  }
  return toSummary(data);
}

/**
 * Sync-Ergebnis (E5) auf die persistierte Studie schreiben. Anders als der
 * Draft-Write NICHT still: der Nutzer hat den Sync aktiv angestoßen — eine
 * fehlende Zeile / ein Schreibfehler kommt als null zurück und wird vom
 * Service in einen sichtbaren Fehler übersetzt.
 */
export async function updatePanelStudySync(params: {
  orgId: string;
  provider: PanelProviderKey;
  providerStudyId: string;
  status: string;
  submissionCounts: Record<string, number>;
  /** Projizierte Gesamtkosten in Cents (E6) — undefined lässt den
   *  bestehenden Wert unangetastet (Kosten-Fetch ist im Sync fail-soft). */
  totalCostCents?: number;
}): Promise<PanelStudySummary | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("panel_studies")
    .update({
      status: params.status,
      submission_counts: params.submissionCounts as Json,
      last_synced_at: new Date().toISOString(),
      ...(params.totalCostCents !== undefined
        ? { total_cost_cents: params.totalCostCents }
        : {}),
    })
    .eq("org_id", params.orgId)
    .eq("provider", params.provider)
    .eq("provider_study_id", params.providerStudyId)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    console.error(
      `updatePanelStudySync failed for study ${params.providerStudyId}:`,
      error?.message ?? "no row returned",
    );
    return null;
  }
  return toSummary(data);
}

/** Jüngster persistierter Draft eines Plans für einen Provider — oder null
 *  (kein Draft, Fehler, oder Migration noch nicht angewandt). */
export async function getLatestPanelStudyForPlan(
  orgId: string,
  planId: string,
  provider: PanelProviderKey,
): Promise<PanelStudySummary | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("panel_studies")
    .select("*")
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .eq("provider", provider)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return toSummary(data);
}

import "server-only";

import { createResearchSupabase } from "@/lib/research/db";
import {
  normalizeEmergentThemes,
  normalizeMethodology,
  normalizePersonas,
  normalizePersonasSummary,
  normalizeStimulusSections,
  normalizeTensions,
} from "@/lib/schemas/synthesis";
import type {
  EmergentTheme,
  EnrichedAudiencePersona,
  Methodology,
  PersonasSummary,
  StimulusSection,
  Tension,
  TensionSide,
} from "@/lib/schemas/synthesis";
import { normalizeSignalsSummary, type SignalsSummary } from "./signals";
import { normalizeStimulusSummary, type StimulusSummary } from "./stimuli";
import {
  coerceInteractionSummary,
  type InteractionSummary,
} from "@/lib/schemas/synthesis-interaction";

/**
 * Read-side service for the study-synthesis UI. Two functions:
 *
 *   - getStudySynthesis(orgId, planId): loads the single persisted row for
 *     a plan (UNIQUE on org_id + plan_id per migration 20260617*). Returns
 *     null when no synthesis has been computed yet — the UI then renders
 *     the empty state with the "create now" CTA.
 *
 *   - countInsightsForPlanSince(orgId, planId, since): drives the
 *     "{n} new interviews since the last synthesis" badge. Counts Stage-1
 *     insights in product_discovery_insights filtered by plan_id and
 *     analyzed_at > since. `since=null` is allowed for "no synthesis yet"
 *     and returns the count of all insights for the plan.
 *
 * Types come from `@/lib/schemas/synthesis` — the same Zod schemas the
 * Stage-2 engine validates against before persisting. The schema's
 * StudySynthesisResult covers (overview / emergent_themes / tensions);
 * the persisted study_synthesis row wraps that with DB-side metadata
 * (id / org_id / plan_id / based_on_count / synthesized_at / model),
 * which the local StudySynthesisRecord below adds.
 */

/** Persisted-row view: schema's content fields PLUS the DB metadata the UI
 *  needs for the "based on N · stand X · M new since" header. `overview`
 *  is nullable here (the migration column is nullable; an empty-seed row
 *  exists before the engine has ever run) — the schema's
 *  StudySynthesisResult.overview is non-null, but that's the output
 *  contract of a successful synth, not the DB state. */
export interface StudySynthesisRecord {
  id: string;
  org_id: string;
  plan_id: string;
  overview: string | null;
  emergent_themes: EmergentTheme[];
  tensions: Tension[];
  based_on_count: number;
  synthesized_at: string | null;
  model: string | null;
  /** E4 — „Warum wurde was gefragt?" (WHY-Rationales thematisch aggregiert).
   *  Null für Bestand / Synthesen ohne Rationale-Input / pre-migration. */
  methodology: Methodology | null;
  /** E4 — deterministische Server-Zahlen der Turn-Signale. Die UI zeigt
   *  Kennzahlen NUR von hier (nie aus LLM-Text). Null unter Mindest-N. */
  signals_summary: SignalsSummary | null;
  /** E4 — max. 3 LLM-formulierte Beobachtungen aus dem Faktenblock. */
  signal_observations: string[];
  /** E7 — deterministische Server-Zahlen des Stimulus-Sets (Gesehen-Zähler,
   *  Präferenz-Stimmen). Die UI zeigt Kennzahlen NUR von hier. Null für
   *  Studien ohne Set / pre-migration. */
  stimulus_summary: StimulusSummary | null;
  /** E7 — LLM-formulierte per-Stimulus-Sektionen (nur Mindest-N-Positionen,
   *  Quotes anker-geprüft). */
  stimulus_sections: StimulusSection[];
  /** E7 — LLM-formulierter Vergleich, nur mit Server-Präferenz-Zahlen. */
  stimulus_comparison: string | null;
  /** Phase D — server-deterministisches Usability-Aggregat (Erfolgsquote, Ø
   *  Zeit/Klicks, Reibungsrate, Judge-Übereinstimmung). Null unter Mindest-N /
   *  Nicht-Usability / pre-migration. Aggregate-only (Art. 22). */
  interaction_summary: InteractionSummary | null;
  /** Ausführlich-Stufe (20260727000000) — Detailgrad + optionale Executive-
   *  Narrative (separate Stufe src/lib/synthesis/narrative.ts). detail_level
   *  defaultet 'standard'; executive_narrative null bis „ausführlich" gewählt. */
  detail_level: string;
  executive_narrative: string | null;
}

export type { EmergentTheme, Tension, TensionSide };

export async function getStudySynthesis(
  orgId: string,
  planId: string,
): Promise<StudySynthesisRecord | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("study_synthesis")
    .select("*")
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .maybeSingle();
  if (error || !data) return null;
  // E4 — defensive Casts (Muster panel_context): pre-migration liefert
  // select("*") die Spalten nicht → undefined → null/[] und die Ansicht
  // bleibt byte-identisch zur signallosen Synthese.
  const row = data as typeof data & {
    methodology?: unknown;
    signals_summary?: unknown;
    signal_observations?: unknown;
    stimulus_summary?: unknown;
    stimulus_sections?: unknown;
    stimulus_comparison?: unknown;
    interaction_summary?: unknown;
    detail_level?: unknown;
    executive_narrative?: unknown;
  };
  return {
    id: data.id,
    org_id: data.org_id,
    plan_id: data.plan_id,
    overview: data.overview,
    emergent_themes: normalizeEmergentThemes(data.emergent_themes),
    tensions: normalizeTensions(data.tensions),
    based_on_count: data.based_on_count,
    synthesized_at: data.synthesized_at,
    model: data.model,
    methodology: normalizeMethodology(row.methodology),
    signals_summary: normalizeSignalsSummary(row.signals_summary),
    signal_observations: Array.isArray(row.signal_observations)
      ? (row.signal_observations as unknown[]).filter(
          (x): x is string => typeof x === "string" && x.trim() !== "",
        )
      : [],
    stimulus_summary: normalizeStimulusSummary(row.stimulus_summary),
    stimulus_sections: normalizeStimulusSections(row.stimulus_sections),
    stimulus_comparison:
      typeof row.stimulus_comparison === "string" &&
      row.stimulus_comparison.trim() !== ""
        ? row.stimulus_comparison
        : null,
    interaction_summary: coerceInteractionSummary(row.interaction_summary),
    detail_level:
      typeof row.detail_level === "string" && row.detail_level.trim() !== ""
        ? row.detail_level
        : "standard",
    executive_narrative:
      typeof row.executive_narrative === "string" &&
      row.executive_narrative.trim() !== ""
        ? row.executive_narrative
        : null,
  };
}

/** Persistierte Persona-Stufe (Spec docs/klymeo-personas-feature-spec-2026-06-21.md).
 *  Liegt in denselben study_synthesis-Spalten (additiv, eigener Schreibpfad in
 *  audience-personas.ts), wird aber getrennt von der Synthese gelesen — der
 *  Personas-Reiter braucht nur diese Felder, und PDF/PPTX/Share tragen in v1
 *  keine Personas. */
export interface StudyPersonasRecord {
  personas: EnrichedAudiencePersona[];
  summary: PersonasSummary | null;
  generatedAt: string | null;
}

/**
 * Lädt die persistierten Personas einer Studie. Gibt null zurück, wenn noch
 * KEIN Persona-Lauf stattfand (keine Personas UND kein Zeitstempel) — die UI
 * zeigt dann den „erzeugen"-Leerzustand. Lief ein Lauf, fand aber keine
 * tragfähigen Segmente, kommt ein Record mit leerer Liste + Zeitstempel zurück
 * (ehrliche „keine Segmente"-Anzeige). Normalizer werfen nie (Muster
 * getStudySynthesis); pre-migration ergibt der Lesefehler null.
 */
export async function getStudyPersonas(
  orgId: string,
  planId: string,
): Promise<StudyPersonasRecord | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("study_synthesis")
    .select("personas, personas_summary, personas_generated_at")
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .maybeSingle();
  if (error || !data) return null;
  const personas = normalizePersonas(data.personas);
  const generatedAt =
    typeof data.personas_generated_at === "string"
      ? data.personas_generated_at
      : null;
  if (personas.length === 0 && generatedAt === null) return null;
  return {
    personas,
    summary: normalizePersonasSummary(data.personas_summary),
    generatedAt,
  };
}

/**
 * Counts Stage-1 insights for a plan since a given timestamp. Used for the
 * "{n} new since the last synthesis" badge.
 *
 * Uses `head: true` with `count: "exact"` so the network only carries the
 * count, not the rows. `gt` (not gte) on `analyzed_at` — an insight stamped
 * at the exact same instant as the synthesis is part of that synthesis, not
 * "new" since it (in practice the ISO collision is astronomically rare; we
 * still pick the semantically correct comparator).
 */
export async function countInsightsForPlanSince(
  orgId: string,
  planId: string,
  since: string | null,
): Promise<number> {
  const supabase = createResearchSupabase();
  let query = supabase
    .from("product_discovery_insights")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("plan_id", planId);
  if (since) query = query.gt("analyzed_at", since);
  const { count, error } = await query;
  if (error || count === null) return 0;
  return count;
}

/**
 * E7 (Konsole-v5): löst Insight-IDs einer Studie auf die interview_session
 * auf, aus der sie extrahiert wurden — für „Interview öffnen“-Belege in der
 * Synthese. Kette: insight.source_call_id → calls.participants.session_id
 * (vom Transcript-Service beim Interview-Abschluss gestempelt), verifiziert
 * gegen interview_sessions (org- UND plan-gebunden).
 *
 * Ältere Interviews (vor dem session_id-Stempel) fehlen schlicht in der Map —
 * die UI fällt dort auf die reine ID-Anzeige zurück. Lieber kein Link als ein
 * falscher: verlinkt wird nur, was über alle drei Stufen sauber auflöst.
 * Fail-open: jeder Lesefehler ergibt eine leere Map, nie einen Seitenfehler.
 */
export async function mapInsightsToSessionIds(
  orgId: string,
  planId: string,
  insightIds: string[],
): Promise<Record<string, string>> {
  if (insightIds.length === 0) return {};
  const supabase = createResearchSupabase();
  try {
    // Die generierten DB-Typen kennen source_call_id (Migration 20260609)
    // nicht — .returns<>() stellt den echten Zeilen-Typ her, ohne wie
    // engine.ts per select("*") alle JSONB-Spalten mitzuziehen.
    const { data: insightRows, error: insErr } = await supabase
      .from("product_discovery_insights")
      .select("id, source_call_id")
      .eq("org_id", orgId)
      .eq("plan_id", planId)
      .in("id", insightIds)
      .returns<Array<{ id: string; source_call_id: string | null }>>();
    if (insErr || !insightRows || insightRows.length === 0) return {};

    const callIds = [
      ...new Set(
        insightRows
          .map((row) => row.source_call_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (callIds.length === 0) return {};

    const { data: callRows, error: callErr } = await supabase
      .from("calls")
      .select("id, participants")
      .eq("org_id", orgId)
      .in("id", callIds);
    if (callErr || !callRows) return {};

    const sessionByCall = new Map<string, string>();
    for (const row of callRows) {
      const sessionId = (row.participants as { session_id?: unknown } | null)
        ?.session_id;
      if (typeof sessionId === "string" && sessionId.length > 0) {
        sessionByCall.set(row.id as string, sessionId);
      }
    }
    if (sessionByCall.size === 0) return {};

    const { data: sessionRows, error: sesErr } = await supabase
      .from("interview_sessions")
      .select("id")
      .eq("org_id", orgId)
      .eq("plan_id", planId)
      .in("id", [...new Set(sessionByCall.values())]);
    if (sesErr || !sessionRows) return {};
    const validSessions = new Set(sessionRows.map((row) => row.id as string));

    const map: Record<string, string> = {};
    for (const row of insightRows) {
      const sessionId = row.source_call_id
        ? sessionByCall.get(row.source_call_id)
        : undefined;
      if (sessionId && validSessions.has(sessionId)) {
        map[row.id] = sessionId;
      }
    }
    return map;
  } catch {
    return {};
  }
}

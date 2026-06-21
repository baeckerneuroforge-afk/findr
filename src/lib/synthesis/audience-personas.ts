import "server-only";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import { normalizeThemes } from "@/lib/schemas/product-discovery";
import {
  AudiencePersonasResultSchema,
  type AudiencePersona,
  type AudiencePersonasResult,
  type EnrichedAudiencePersona,
  type PersonaSentimentDistribution,
  type PersonasSummary,
} from "@/lib/schemas/synthesis";
import { coerceStudyType, coerceUseCase } from "@/lib/research/plans-service";
import type { Json } from "@/types/database";

import {
  AnchorSet,
  buildAnchorSet,
  createSynthSupabase,
  quoteAnchoredInCitedIds,
  StudySynthesisUnavailableError,
} from "./engine";
import {
  AUDIENCE_PERSONAS_SYSTEM_PROMPT,
  buildAudiencePersonasUserPrompt,
  type SynthesisInput,
  type SynthesisInsightInput,
  type SynthesisPlanContext,
} from "./prompts";

/**
 * Persona-Stufe (Spec docs/klymeo-personas-feature-spec-2026-06-21.md): eine
 * ADDITIVE, zweite LLM-Stufe über derselben Stage-2-Eingabe wie die Synthese.
 * Sie clustert die Befragten in 3-5 Markt-Segmente (v1 nur market_research) und
 * setzt denselben Anti-Halluzinations-Vertrag wie die Synthese durch — nur
 * härter: jedes Trait-FELD braucht ein verankertes Zitat, jede Persona ≥ 2
 * Stimmen und ≥ 2 Zitate, die Größe (shareCount) wird server-seitig erzwungen
 * (das frequency-Override-Muster der EmergentTheme), und die Cluster werden zu
 * einer strikten Partition disjunkt gemacht.
 *
 * Drei Schichten (wie engine.ts):
 *  1. Schema (AudiencePersonasResultSchema) — Form, .min(2) Mitglieder, .min(1)
 *     Evidence.
 *  2. Anker-Filter (applyPersonaAnchoredFilter) — IDs müssen im Input existieren;
 *     jedes Evidence-Zitat + leadQuote PER INSIGHT verankert (kein Cross-
 *     Respondent); unbelegte Trait-Felder werden unterdrückt; Personas < 2
 *     Mitglieder / < 2 Zitate fallen.
 *  3. Partition (enforcePartition) — jede Befragte:r genau einer Persona
 *     (stärkste Evidence gewinnt); danach erneuter Min-Gate-Check.
 * Danach Server-Anreicherung (enrichPersonas): shareCount/sharePercent,
 * roleLabel/segmentLabel (Modus), sentimentDistribution — NIE vom Modell.
 */

export const DEFAULT_PERSONA_MODEL = CLAUDE_MODELS.opus;

/** Mindestdaten-Gate: erst ab so vielen ausgewerteten Interviews erzeugbar. */
export const MIN_PERSONA_INTERVIEWS = 10;
/** Unter dieser Schwelle wird ein Qualitäts-Hinweis gezeigt (10-14). */
export const PERSONA_QUALITY_HINT_UNTIL = 15;

/** Eine Persona braucht mindestens 2 Mitglieder (keine Persona aus n=1) … */
const MIN_PERSONA_MEMBERS = 2;
/** … und mindestens 2 verankerte Zitate (sonst unterdrückt). */
const MIN_PERSONA_QUOTES = 2;

// ── Anker-Helfer ────────────────────────────────────────────────────────────

function evidenceCountForId(persona: AudiencePersona, id: string): number {
  return persona.evidence.filter((e) => e.sourceInsightIds.includes(id)).length;
}

/**
 * Eine Persona gegen den Anker-Set härten, beschränkt auf `allowedIds`
 * (= ihre nach Partition zugewiesenen Mitglieder; im ersten Durchlauf alle
 * selbst beanspruchten IDs). Gibt null zurück, wenn die Persona nach dem Härten
 * den Mindest-Gate (≥ 2 Mitglieder, ≥ 2 verankerte Zitate, ≥ 1 belegtes
 * Trait-Feld) nicht mehr erfüllt. Pure Funktion.
 */
export function finalizePersona(
  persona: AudiencePersona,
  allowedIds: Set<string>,
  anchors: AnchorSet,
): AudiencePersona | null {
  // Mitgliedschaft: nur erlaubte UND im Input existierende IDs, dedupliziert.
  const memberIds = Array.from(
    new Set(
      persona.sourceInsightIds.filter(
        (id) => allowedIds.has(id) && anchors.ids.has(id),
      ),
    ),
  );
  if (memberIds.length < MIN_PERSONA_MEMBERS) return null;
  const memberSet = new Set(memberIds);

  // Evidence: cited ids auf Mitglieder beschränken; Zitat muss in MINDESTENS
  // EINEM dieser Mitglieder verbatim belegt sein (per-Insight, kein Cross-
  // Respondent). Was nicht belegt ist, fällt.
  const survivingEvidence = persona.evidence.flatMap((ev) => {
    const ids = ev.sourceInsightIds.filter((id) => memberSet.has(id));
    if (!quoteAnchoredInCitedIds(ev.text, ids, anchors)) return [];
    return [{ field: ev.field, text: ev.text, sourceInsightIds: ids }];
  });

  // Trait-Feld-Unterdrückung: ein Feld überlebt nur mit ≥ 1 verankerter
  // Evidence DIESES Feldes (Spec §5.2 „pro Feld hart belegt").
  const backed = (field: string): boolean =>
    survivingEvidence.some((e) => e.field === field);
  const goals = backed("goal") ? persona.goals : [];
  const pains = backed("pain") ? persona.pains : [];
  const behavior = backed("behavior") ? persona.behavior : [];
  const motivation = backed("motivation") ? persona.motivation : "";

  // leadQuote: verankert behalten; sonst auf eine überlebende Evidence
  // zurückfallen; sonst leeren.
  let leadQuote = quoteAnchoredInCitedIds(persona.leadQuote, memberIds, anchors)
    ? persona.leadQuote
    : "";
  if (leadQuote === "" && survivingEvidence.length > 0) {
    leadQuote = survivingEvidence[0].text;
  }

  // Mindest-Zitatdichte: ≥ 2 DISTINKTE verankerte Zitate (Evidence + leadQuote).
  const quoteTexts = new Set(survivingEvidence.map((e) => e.text));
  if (leadQuote !== "") quoteTexts.add(leadQuote);
  if (quoteTexts.size < MIN_PERSONA_QUOTES) return null;

  // Eine Persona ganz ohne substanzielles Trait-Feld ist wertlos → verwerfen.
  if (
    goals.length === 0 &&
    pains.length === 0 &&
    behavior.length === 0 &&
    motivation === ""
  ) {
    return null;
  }

  return {
    name: persona.name,
    shareCount: memberIds.length, // advisory; enrichPersonas setzt final
    goals,
    pains,
    behavior,
    motivation,
    leadQuote,
    sourceInsightIds: memberIds,
    evidence: survivingEvidence,
  };
}

/** Erste Schicht: jede Persona einzeln gegen ihre selbst beanspruchten IDs
 *  härten. Pure Funktion (exported für Unit-Tests). */
export function applyPersonaAnchoredFilter(
  raw: AudiencePersonasResult,
  anchors: AnchorSet,
): AudiencePersona[] {
  return raw.personas.flatMap((p) => {
    const fin = finalizePersona(p, new Set(p.sourceInsightIds), anchors);
    return fin ? [fin] : [];
  });
}

/**
 * Zweite Schicht — strikte Partition: jede Befragte:r genau einer Persona
 * zuordnen. Bei Überschneidung gewinnt die Persona mit der stärksten Evidence
 * für diese ID (mehr belegende Zitate), Gleichstand → größere Persona, dann
 * frühere Position. Danach wird jede Persona erneut gehärtet (Mitglieder können
 * unter den Mindest-Gate fallen → Persona fällt). Pure Funktion.
 */
export function enforcePartition(
  personas: AudiencePersona[],
  anchors: AnchorSet,
): AudiencePersona[] {
  const allIds = new Set<string>();
  for (const p of personas) for (const id of p.sourceInsightIds) allIds.add(id);

  const idToWinner = new Map<string, number>();
  for (const id of allIds) {
    let winner = -1;
    let bestEvidence = -1;
    let bestSize = -1;
    personas.forEach((p, idx) => {
      if (!p.sourceInsightIds.includes(id)) return;
      const ev = evidenceCountForId(p, id);
      const size = p.sourceInsightIds.length;
      // Nur bei STRIKT besserer Evidence oder gleicher Evidence + größerer
      // Persona ersetzen → voller Gleichstand behält die frühere Position.
      if (winner === -1 || ev > bestEvidence || (ev === bestEvidence && size > bestSize)) {
        winner = idx;
        bestEvidence = ev;
        bestSize = size;
      }
    });
    if (winner >= 0) idToWinner.set(id, winner);
  }

  return personas.flatMap((p, idx) => {
    const allowed = new Set(
      p.sourceInsightIds.filter((id) => idToWinner.get(id) === idx),
    );
    const fin = finalizePersona(p, allowed, anchors);
    return fin ? [fin] : [];
  });
}

// ── Server-Anreicherung (kein LLM) ──────────────────────────────────────────

function mostCommonLabel(values: Array<string | null>): string | null {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "") {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

function buildSentimentDistribution(
  members: SynthesisInsightInput[],
): PersonaSentimentDistribution {
  const d: PersonaSentimentDistribution = {
    positive: 0,
    neutral: 0,
    negative: 0,
    mixed: 0,
    unknown: 0,
  };
  for (const m of members) {
    switch (m.sentiment) {
      case "positive":
        d.positive++;
        break;
      case "neutral":
        d.neutral++;
        break;
      case "negative":
        d.negative++;
        break;
      case "mixed":
        d.mixed++;
        break;
      default:
        d.unknown++;
    }
  }
  return d;
}

/**
 * Dritte Schicht — Server-Felder ergänzen: shareCount HART = unique(members),
 * sharePercent gegen den Live-Insight-Count, roleLabel/segmentLabel als Modus,
 * sentimentDistribution aus den echten Insight-Sentiments. Diese Felder kommen
 * NIE aus dem LLM. Liefert zusätzlich die ehrliche PersonasSummary. Pure
 * Funktion (exported für Unit-Tests).
 */
export function enrichPersonas(
  personas: AudiencePersona[],
  insights: SynthesisInsightInput[],
  totalInsights: number,
): { personas: EnrichedAudiencePersona[]; summary: PersonasSummary } {
  const byId = new Map(insights.map((i) => [i.id, i]));
  const enriched: EnrichedAudiencePersona[] = personas.map((p) => {
    const members = p.sourceInsightIds
      .map((id) => byId.get(id))
      .filter((m): m is SynthesisInsightInput => m !== undefined);
    const shareCount = p.sourceInsightIds.length;
    const sharePercent =
      totalInsights > 0 ? Math.round((shareCount / totalInsights) * 100) : 0;
    return {
      ...p,
      shareCount,
      sharePercent,
      roleLabel: mostCommonLabel(members.map((m) => m.respondentRole)),
      segmentLabel: mostCommonLabel(members.map((m) => m.respondentSegment)),
      sentimentDistribution: buildSentimentDistribution(members),
    };
  });

  const assigned = enriched.reduce((sum, p) => sum + p.shareCount, 0);
  const summary: PersonasSummary = {
    version: 1,
    totalInsights,
    assigned,
    unassigned: Math.max(0, totalInsights - assigned),
    qualityHint: totalInsights < PERSONA_QUALITY_HINT_UNTIL,
  };
  return { personas: enriched, summary };
}

// ── Pure LLM-Eintrittspunkt (eval-fähig, keine DB) ──────────────────────────

/**
 * Reiner LLM-Pfad: Prompt bauen → erzwungener Tool-Call → drei Schichten
 * (Anker-Filter, Partition, Anreicherung). KEINE Persistenz. Fail-closed
 * (StudySynthesisUnavailableError). Vom Eval-Runner ohne Supabase aufrufbar.
 */
export async function clusterPersonasFromInputs(
  input: SynthesisInput,
  model: string = process.env.SYNTHESIS_PERSONA_MODEL ?? DEFAULT_PERSONA_MODEL,
): Promise<{ personas: EnrichedAudiencePersona[]; summary: PersonasSummary }> {
  const userPrompt = buildAudiencePersonasUserPrompt(input);
  const anchors = buildAnchorSet(input.insights);

  let raw: AudiencePersonasResult;
  try {
    raw = await callClaudeStructured({
      schema: AudiencePersonasResultSchema,
      system: AUDIENCE_PERSONAS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      model,
      // Personas tragen 3-5 Segmente mit je 4 Trait-Feldern + Evidence-Belegen;
      // realistisch ~5-10k Output-Tokens. 16000 gibt Marge vor Truncation →
      // Zod-Fail → fail-closed, ohne im Normalfall zu greifen.
      maxTokens: 16_000,
      timeoutMs: 180_000,
      toolName: "emit_audience_personas",
      toolDescription:
        "Return 3-5 audience personas that partition the respondents, each grounded in verbatim quotes from the supplied insights.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      throw new StudySynthesisUnavailableError(
        "Claude persona clustering returned invalid output twice",
        err,
      );
    }
    throw new StudySynthesisUnavailableError(
      "Claude persona clustering call failed",
      err,
    );
  }

  const anchored = applyPersonaAnchoredFilter(raw, anchors);
  const partitioned = enforcePartition(anchored, anchors);
  return enrichPersonas(partitioned, input.insights, input.insights.length);
}

// ── DB-getriebener Eintrittspunkt ───────────────────────────────────────────

export interface GeneratePersonasResult {
  status:
    | "generated"
    | "plan_not_found"
    | "no_insights"
    | "insufficient_data"
    | "wrong_study_type";
  personas: EnrichedAudiencePersona[];
  summary: PersonasSummary | null;
  /** Insight-Count zum Zeitpunkt des Aufrufs (für die UI-Gate-Meldung). */
  count: number;
  generatedAt: string | null;
  message: string | null;
}

/**
 * Lädt Plan + Insights, prüft den Min-Gate (Spec §5.6) und den Studientyp
 * (v1 nur market_research), clustert, und upsertet die Personas additiv in
 * study_synthesis (eigener Schreibpfad — clobbert NIE die Synthese-Spalten;
 * legt die Zeile mit Defaults an, falls noch keine Synthese existiert).
 */
export async function generatePersonas(
  orgId: string,
  planId: string,
  model: string = process.env.SYNTHESIS_PERSONA_MODEL ?? DEFAULT_PERSONA_MODEL,
): Promise<GeneratePersonasResult> {
  const supabase = createSynthSupabase();

  const { data: planRow, error: planErr } = await supabase
    .from("research_plans")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", planId)
    .maybeSingle();
  if (planErr || !planRow) {
    return {
      status: "plan_not_found",
      personas: [],
      summary: null,
      count: 0,
      generatedAt: null,
      message: "Research plan not found in this organization.",
    };
  }

  const studyType = coerceStudyType(planRow.study_type);
  if (studyType !== "market_research") {
    return {
      status: "wrong_study_type",
      personas: [],
      summary: null,
      count: 0,
      generatedAt: null,
      message:
        "Personas sind in v1 nur für Marktforschungs-Studien verfügbar.",
    };
  }

  const { data: insightRows, error: insErr } = await supabase
    .from("product_discovery_insights")
    .select("*")
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .order("analyzed_at", { ascending: true });
  if (insErr || !insightRows) {
    throw new StudySynthesisUnavailableError(
      `Failed to read insights for plan ${planId}: ${insErr?.message ?? "no rows"}`,
    );
  }

  const count = insightRows.length;
  if (count === 0) {
    return {
      status: "no_insights",
      personas: [],
      summary: null,
      count: 0,
      generatedAt: null,
      message:
        "No product_discovery_insights yet for this plan — nothing to cluster.",
    };
  }
  if (count < MIN_PERSONA_INTERVIEWS) {
    return {
      status: "insufficient_data",
      personas: [],
      summary: null,
      count,
      generatedAt: null,
      message: `Mindestens ${MIN_PERSONA_INTERVIEWS} ausgewertete Interviews nötig (aktuell ${count}).`,
    };
  }

  const insights: SynthesisInsightInput[] = insightRows.map((r) => ({
    id: r.source_call_id,
    summary: r.summary,
    featureRequests: (r.feature_requests as unknown as unknown[]) ?? [],
    painPoints: (r.pain_points as unknown as unknown[]) ?? [],
    themes: normalizeThemes(r.themes),
    respondentRole: r.respondent_role,
    respondentSegment: r.respondent_segment,
    sentiment: r.sentiment,
  }));

  const plan: SynthesisPlanContext = {
    title: planRow.title,
    objective: planRow.objective,
    persona: planRow.persona,
    studyType,
    useCase: coerceUseCase(planRow.use_case),
  };

  const { personas, summary } = await clusterPersonasFromInputs(
    { plan, insights },
    model,
  );

  const generatedAt = new Date().toISOString();
  // Upsert auf (org_id, plan_id): aktualisiert NUR die Persona-Spalten; existiert
  // noch keine Synthese-Zeile, legt der Insert sie mit den DB-Defaults an
  // (emergent_themes/tensions '[]', synthesized_at null → UI zeigt Synthese
  // weiterhin als „leer"). Die Synthese-Spalten werden nie berührt.
  const { error: upsertErr } = await supabase.from("study_synthesis").upsert(
    {
      org_id: orgId,
      plan_id: planId,
      personas: personas as unknown as Json,
      personas_summary: summary as unknown as Json,
      personas_generated_at: generatedAt,
    },
    { onConflict: "org_id,plan_id" },
  );
  if (upsertErr) {
    throw new StudySynthesisUnavailableError(
      `Failed to upsert personas: ${upsertErr.message}`,
    );
  }

  return {
    status: "generated",
    personas,
    summary,
    count,
    generatedAt,
    message: null,
  };
}

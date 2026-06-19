import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import type { Database, Json } from "@/types/database";
import { normalizeThemes } from "@/lib/schemas/product-discovery";
import {
  StudySynthesisResultSchema,
  type EmergentTheme,
  type StimulusSection,
  type StudySynthesisResult,
  type Tension,
  type TensionSide,
} from "@/lib/schemas/synthesis";
import {
  coerceStudyType,
  coerceUseCase,
} from "@/lib/research/plans-service";
import type {
  ResearchPlanStudyType,
  ResearchPlanUseCase,
} from "@/lib/research/db";
import {
  selectSynthesisSystemPrompt,
  buildSynthesisUserPrompt,
  type SynthesisInput,
  type SynthesisInsightInput,
  type SynthesisPlanContext,
} from "./prompts";
import { loadSynthesisSignalInputs } from "./signals";
import { loadSynthesisStimulusInputs } from "./stimuli";

/**
 * Stage-2 Study-Synthesis engine. Reads all product_discovery_insights of
 * ONE research_plan, runs ONE Opus call over the verdichteten Felder
 * (NEVER raw transcripts — cost guardrail), validates the JSON against
 * StudySynthesisResultSchema, applies a second anchored-filter to drop
 * any theme/tension that cites unknown insight ids or paraphrased
 * quotes, then upserts into study_synthesis.
 *
 * Model: Opus by default. Override via SYNTHESIS_MODEL env (cheap-run
 * the evals on Sonnet, ship Opus to production — same pattern as
 * HEALTH_MODEL / PRODUCT_DISCOVERY_MODEL).
 *
 * Anchoring is enforced THREE times:
 *  1. Schema (StudySynthesisResultSchema) — sourceInsightIds non-empty.
 *  2. ID set check — each cited id must appear in the input set.
 *  3. Quote fold-substring check — each quote must be a verbatim
 *     substring of the input verdichtungen after typography fold.
 * A theme that loses ALL its sourceInsightIds in step 2 or all its
 * quotes in step 3 is dropped entirely. A tension whose two sides
 * share any sourceInsightId is dropped (same respondent can't be on
 * both sides). frequency is always overridden post-filter with
 * unique(sourceInsightIds).length — the model's number is advisory,
 * the engine's number is authoritative.
 *
 * GROUNDING — was maschinell verankert ist und was NICHT (ehrlich, nicht
 * überverkaufend). Die Synthese trennt zwei Arten von Output:
 *  - MASCHINELL VERANKERT: `sourceInsightIds` (müssen im Input-Set existieren)
 *    und `quotes` (müssen nach Typografie-Fold wörtlich in mindestens einer der
 *    ZITIERTEN Insight-IDs vorkommen — Per-Insight-Anker). Was diese Prüfung
 *    nicht besteht, wird verworfen.
 *  - INTERPRETIERENDE PROSA, NICHT maschinell verankert: `overview`,
 *    `emergent_themes[].summary` und `tensions[].description` sind die
 *    FORMULIERUNG des Modells. Sie sind im Prompt an die zitierten Insights
 *    gebunden (das Modell zitiert IDs), aber es gibt KEINE programmatische
 *    Wort-für-Wort-Prüfung ihres Inhalts. Eine Mengen- oder Wertaussage in
 *    dieser Prosa ist nur so verlässlich wie das Modell — sie ist KEINE vom
 *    Server bestätigte Kennzahl. Verlässliche Kennzahlen kommen ausschließlich
 *    aus den Server-Feldern (`based_on_count`, `frequency`, `signals_summary`,
 *    `stimulus_summary`).
 * Die Synthese-Eval MISST die Treue dieser Prosa zusätzlich (deterministischer
 * Zahlen-Scan + LLM-Grounding-Judge, siehe src/lib/synthesis/eval-checks.ts und
 * evals-synthesis/), aber das ist eine QUALITÄTSMESSUNG, kein Persistenz-Gate:
 * der Prod-Pfad schreibt die Prosa unverändert.
 */

export const DEFAULT_SYNTHESIS_MODEL = CLAUDE_MODELS.opus;

export class StudySynthesisUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "StudySynthesisUnavailableError";
  }
}

// ── Database type augmentation ──────────────────────────────────────────────
//
// Mirrors src/lib/product-discovery/service.ts: until src/types/database.ts
// is regenerated post-migrations, we declare the new tables (study_synthesis)
// and the new columns (product_discovery_insights.{respondent_*, plan_id,
// respondent_source}) inline so supabase-js's .from(…).insert/upsert/select
// narrows correctly. Once `supabase gen types` runs, this block can shrink
// back to a thin Database alias.

type SentimentValue = "positive" | "neutral" | "negative" | "mixed";

type ProductDiscoveryInsightRow = {
  id: string;
  org_id: string;
  source_call_id: string;
  deal_id: string | null;
  account_id: string | null;
  feature_requests: Json;
  pain_points: Json;
  themes: Json;
  summary: string | null;
  analysis_method: string;
  analyzed_at: string;
  created_at: string;
  respondent_role: string | null;
  respondent_segment: string | null;
  sentiment: SentimentValue | null;
  plan_id: string | null;
  respondent_source: "ai" | "screening";
};

type StudySynthesisRow = {
  id: string;
  org_id: string;
  plan_id: string;
  emergent_themes: Json;
  tensions: Json;
  overview: string | null;
  based_on_count: number;
  synthesized_at: string | null;
  model: string | null;
  created_at: string;
  // E4 (20260704000003) — additive, nullable; geschrieben nur vom
  // best-effort Zweit-UPDATE in synthesizeStudy (pre-migration-safe).
  methodology: Json | null;
  signals_summary: Json | null;
  signal_observations: Json | null;
  // E7 (20260714000001) — additive, nullable; geschrieben nur vom selben
  // best-effort Zweit-UPDATE (pre-migration-safe).
  stimulus_summary: Json | null;
  stimulus_sections: Json | null;
  stimulus_comparison: string | null;
};

type StudySynthesisInsert = {
  id?: string;
  org_id: string;
  plan_id: string;
  emergent_themes?: Json;
  tensions?: Json;
  overview?: string | null;
  based_on_count?: number;
  synthesized_at?: string | null;
  model?: string | null;
  created_at?: string;
  methodology?: Json | null;
  signals_summary?: Json | null;
  signal_observations?: Json | null;
  stimulus_summary?: Json | null;
  stimulus_sections?: Json | null;
  stimulus_comparison?: string | null;
};

type StudySynthesisUpdate = Partial<StudySynthesisInsert>;

type ResearchPlanRow = {
  id: string;
  org_id: string | null;
  title: string;
  objective: string;
  topic_script: Json;
  persona: string | null;
  sample_target: number | null;
  status: string;
  // Studientyp-Diskriminator (M0, 20260630000000). Read in synthesizeStudy to
  // select the synthesis persona (M2). Coerced defensively via coerceStudyType
  // on read — pre-migration select("*") omits the column (undefined → default).
  study_type: ResearchPlanStudyType;
  use_case?: ResearchPlanUseCase | null;
  created_at: string;
};

// Object-literal types (NOT Partial<Row>) — supabase-js's select-string
// parser narrows row shapes against the Row property; Partial collapses
// the keys into `GenericStringError` at the call site. Mirror the
// pattern from src/lib/product-discovery/service.ts.
type ProductDiscoveryInsightInsert = {
  id?: string;
  org_id?: string;
  source_call_id?: string;
  deal_id?: string | null;
  account_id?: string | null;
  feature_requests?: Json;
  pain_points?: Json;
  themes?: Json;
  summary?: string | null;
  analysis_method?: string;
  analyzed_at?: string;
  created_at?: string;
  respondent_role?: string | null;
  respondent_segment?: string | null;
  sentiment?: SentimentValue | null;
  plan_id?: string | null;
  respondent_source?: "ai" | "screening";
};

type ResearchPlanInsert = {
  id?: string;
  org_id?: string | null;
  title?: string;
  objective?: string;
  topic_script?: Json;
  persona?: string | null;
  sample_target?: number | null;
  status?: string;
  study_type?: ResearchPlanStudyType;
  created_at?: string;
};

type DatabaseWithSynth = {
  __InternalSupabase: Database["__InternalSupabase"];
  public: {
    Tables: Database["public"]["Tables"] & {
      product_discovery_insights: {
        Row: ProductDiscoveryInsightRow;
        Insert: ProductDiscoveryInsightInsert;
        Update: ProductDiscoveryInsightInsert;
        Relationships: [];
      };
      study_synthesis: {
        Row: StudySynthesisRow;
        Insert: StudySynthesisInsert;
        Update: StudySynthesisUpdate;
        Relationships: [];
      };
      research_plans: {
        Row: ResearchPlanRow;
        Insert: ResearchPlanInsert;
        Update: ResearchPlanInsert;
        Relationships: [];
      };
    };
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"];
    Enums: Database["public"]["Enums"];
    CompositeTypes: Database["public"]["CompositeTypes"];
  };
};

function createSynthSupabase(): SupabaseClient<DatabaseWithSynth> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin operations.",
    );
  }
  return createClient<DatabaseWithSynth>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

// ── Anchored-filter helpers (the second layer on top of Zod) ────────────────

/** Same fold used by evals-product-discovery/run.ts so quote membership
 *  is robust against umlauts, smart quotes, and en/em-dashes. Kept inline
 *  rather than imported so this file doesn't depend on the evals tree. */
function fold(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/Ä/g, "Ae")
    .replace(/ä/g, "ae")
    .replace(/Ö/g, "Oe")
    .replace(/ö/g, "oe")
    .replace(/Ü/g, "Ue")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/["'„“”«»‘’‚‹›]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

interface AnchorSet {
  /** ids the LLM is allowed to cite (from the input insights). */
  ids: Set<string>;
  /** Folded haystack of ALL per-item evidence + summary text (across every
   *  insight) PLUS the E7 stimulus excerpts. Used ONLY for stimulus-section
   *  quotes, which carry no sourceInsightIds and are anchored against the
   *  set's first-reaction excerpts, not against an individual insight. */
  foldedHaystack: string;
  /** Per-insight folded haystack, keyed by insight id. A theme/tension-side
   *  quote must appear in the union of the haystacks of the insight ids that
   *  the theme/side actually CITES — not merely somewhere in the combined
   *  material. This blocks cross-respondent quote attribution (a quote from
   *  respondent B can no longer be hung on a theme that only cites A). Built
   *  ONLY from insight strings; stimulus excerpts belong to no insight and
   *  stay out of this map. */
  byId: Map<string, string>;
}

export function buildAnchorSet(
  insights: SynthesisInsightInput[],
  // E7 — zusätzliche wörtlich zitierbare Texte (Erstreaktions-Ausschnitte
  // des Stimulus-Blocks): Sektion-Quotes müssen GENAU dort belegt sein. Sie
  // gehören zu keinem Insight und wandern deshalb NUR in den globalen
  // foldedHaystack, nicht in die per-Insight-Map.
  extraTexts: string[] = [],
): AnchorSet {
  const ids = new Set<string>();
  const byId = new Map<string, string>();
  const globalParts: string[] = [...extraTexts];
  for (const ins of insights) {
    ids.add(ins.id);
    const parts: string[] = [];
    if (ins.summary) parts.push(ins.summary);
    // Pull every nested "evidence" / "quotes" / "summary" string out of the
    // jsonb-ish payloads — robust to the exact Stage-1 shape, just collects
    // anything that could be a verbatim quote.
    collectStrings(ins.featureRequests, parts);
    collectStrings(ins.painPoints, parts);
    collectStrings(ins.themes, parts);
    const folded = fold(parts.join(" \n "));
    // Defensive: if the same id appears twice (shouldn't — one call = one
    // respondent), concatenate rather than overwrite.
    byId.set(
      ins.id,
      byId.has(ins.id) ? `${byId.get(ins.id)} ${folded}` : folded,
    );
    globalParts.push(...parts);
  }
  return { ids, foldedHaystack: fold(globalParts.join(" \n ")), byId };
}

function collectStrings(value: unknown, sink: string[]): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    sink.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, sink);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectStrings(v, sink);
    }
  }
}

/** A theme/tension-side quote is anchored ONLY if it appears verbatim (after
 *  the same typography fold used everywhere) in AT LEAST ONE of the insight
 *  ids it actually cites. The global haystack is deliberately NOT consulted
 *  here: a quote that exists in some OTHER respondent's material must not be
 *  attributable to a theme/side that does not cite that respondent
 *  (cross-respondent attribution guard). An empty/whitespace-only quote folds
 *  to "" and is dropped (a "" substring would otherwise match everything). */
function quoteAnchoredInCitedIds(
  quote: string,
  citedIds: string[],
  anchors: AnchorSet,
): boolean {
  const folded = fold(quote);
  if (folded === "") return false;
  for (const id of citedIds) {
    const hay = anchors.byId.get(id);
    if (hay && hay.includes(folded)) return true;
  }
  return false;
}

/** Drop ids that aren't in the anchor set; drop quotes that aren't verbatim
 *  in one of THIS side's cited ids. Returns a filtered side; caller decides
 *  whether the side has enough left to survive. */
function filterTensionSide(
  side: TensionSide,
  anchors: AnchorSet,
): TensionSide {
  const validIds = side.sourceInsightIds.filter((id) => anchors.ids.has(id));
  return {
    label: side.label,
    sourceInsightIds: validIds,
    // Per-Insight statt global: das Zitat muss in MINDESTENS EINER der
    // tatsächlich zitierten (und existierenden) IDs dieser Seite belegt sein.
    quotes: side.quotes.filter((q) =>
      quoteAnchoredInCitedIds(q, validIds, anchors),
    ),
  };
}

/** Engine-side cleanup: drop hallucinated content, override frequency. */
export function applyAnchoredFilter(
  raw: StudySynthesisResult,
  anchors: AnchorSet,
): StudySynthesisResult {
  const themes: EmergentTheme[] = [];
  for (const t of raw.emergent_themes) {
    const validIds = t.sourceInsightIds.filter((id) => anchors.ids.has(id));
    // Distinct count is the authoritative frequency — the LLM's number is
    // advisory. If the LLM said 5 but only 3 unique IDs survive, frequency
    // becomes 3.
    const uniqueIds = Array.from(new Set(validIds));
    if (uniqueIds.length === 0) continue; // wholly unanchored — drop
    // Per-Insight statt global: das Zitat muss in MINDESTENS EINER der
    // tatsächlich zitierten IDs dieses Themes vorkommen. Ein fehl-attribuiertes
    // Zitat fällt; das Theme überlebt weiter über seine gültigen IDs (die
    // Drop-Regel ist unverändert: nur uniqueIds.length === 0 verwirft es).
    const validQuotes = t.quotes.filter((q) =>
      quoteAnchoredInCitedIds(q, uniqueIds, anchors),
    );
    themes.push({
      title: t.title,
      summary: t.summary,
      frequency: uniqueIds.length,
      sourceInsightIds: uniqueIds,
      quotes: validQuotes,
    });
  }

  const tensions: Tension[] = [];
  for (const t of raw.tensions) {
    const side_a = filterTensionSide(t.side_a, anchors);
    const side_b = filterTensionSide(t.side_b, anchors);
    // Each side must keep ≥1 anchored id after filtering.
    if (side_a.sourceInsightIds.length === 0) continue;
    if (side_b.sourceInsightIds.length === 0) continue;
    // Sides must be DISJOINT — the same respondent can't be on both
    // sides of the same disagreement. If they overlap, the model
    // conflated the disagreement; drop the tension.
    const aSet = new Set(side_a.sourceInsightIds);
    const overlap = side_b.sourceInsightIds.some((id) => aSet.has(id));
    if (overlap) continue;
    tensions.push({
      description: t.description,
      side_a,
      side_b,
    });
  }

  return {
    overview: raw.overview,
    emergent_themes: themes,
    tensions,
    methodology: raw.methodology,
    signal_observations: raw.signal_observations,
    stimulus_sections: raw.stimulus_sections,
    stimulus_comparison: raw.stimulus_comparison,
  };
}

/**
 * E7 — Stimulus-Sektionen härten: nur ELIGIBLE Positionen (Mindest-N, vom
 * Server bestimmt), höchstens eine Sektion pro Position, Quotes nur wörtlich
 * aus dem Anker-Haystack (die Erstreaktions-Ausschnitte reisen via
 * buildAnchorSet-extraTexts hinein). Pure Funktion, exported for unit tests.
 */
export function filterStimulusSections(
  sections: StimulusSection[],
  eligiblePositions: number[],
  anchors: AnchorSet,
): StimulusSection[] {
  const eligible = new Set(eligiblePositions);
  const seen = new Set<number>();
  const kept: StimulusSection[] = [];
  for (const section of sections) {
    if (!eligible.has(section.position) || seen.has(section.position)) continue;
    seen.add(section.position);
    kept.push({
      position: section.position,
      summary: section.summary,
      quotes: section.quotes.filter((q) =>
        anchors.foldedHaystack.includes(fold(q)),
      ),
    });
  }
  return kept;
}

/**
 * E4/E7 — Server-Guard für die additiven Felder: was der Prompt nicht als
 * Input trug, darf das Modell nicht behaupten. Ohne RATIONALES-Block wird
 * methodology hart genullt, ohne SIGNALS-Block werden signal_observations
 * hart geleert, ohne STIMULUS-Block (bzw. ohne Server-Präferenz-Zahlen)
 * fallen stimulus_sections/stimulus_comparison — kein Halluzinations-
 * Fenster, unabhängig vom Modell. Pure Funktion, exported for unit tests.
 */
export function sealSynthesisExtras(
  result: StudySynthesisResult,
  hadSignals: boolean,
  hadRationales: boolean,
  hadStimuli = false,
  hadPreference = false,
): StudySynthesisResult {
  return {
    ...result,
    methodology: hadRationales ? result.methodology : null,
    signal_observations: hadSignals ? result.signal_observations : [],
    stimulus_sections: hadStimuli ? result.stimulus_sections : [],
    // Vergleichs-PROSA nur, wenn die Server-Zählung lief — ein Vergleich
    // ohne Zahlenbasis wäre genau die LLM-Behauptung, die E7 ausschließt.
    stimulus_comparison:
      hadStimuli && hadPreference ? result.stimulus_comparison : null,
  };
}

// ── Opus call (mirrors product-discovery/classifier.ts) ─────────────────────

/** Pure LLM entry — exposed for the eval runner so it can drive the
 *  synthesizer with hand-crafted inputs without going through Supabase.
 *  Robust transport (forced tool-use via callClaudeStructured — no text-JSON
 *  regex/parse), schema-validates, applies the anchored-filter, returns the
 *  cleaned result. NO persistence. Fail-closed preserved
 *  (StudySynthesisUnavailableError). */
export async function synthesizeFromInputs(
  input: SynthesisInput,
  model: string = process.env.SYNTHESIS_MODEL ?? DEFAULT_SYNTHESIS_MODEL,
): Promise<StudySynthesisResult> {
  const userPrompt = buildSynthesisUserPrompt(input);
  // E7 — die Erstreaktions-Ausschnitte sind die einzige wörtliche Quelle der
  // Stimulus-Sektion-Quotes und wandern deshalb mit in den Anker-Haystack.
  const stimulusExcerpts =
    input.stimuli?.excerpts.flatMap((e) => e.excerpts) ?? [];
  const anchors = buildAnchorSet(input.insights, stimulusExcerpts);

  let raw: StudySynthesisResult;
  try {
    raw = await callClaudeStructured({
      schema: StudySynthesisResultSchema,
      // Persona by study_type; market studies optionally add the Stage-2
      // use-case focus. Everything else about this call — schema, user prompt,
      // tool name, maxTokens, anchored-filter — stays shared and unchanged.
      system: selectSynthesisSystemPrompt(
        input.plan.studyType,
        input.plan.useCase,
      ),
      messages: [{ role: "user", content: userPrompt }],
      model,
      // Ceiling, not a cost floor (abgerechnet werden nur erzeugte Tokens).
      // Realistische Synthesen liegen bei ~3-5k Output-Tokens; eine reiche
      // Marktstudie (bis 12 Themen + 6 Tensions + E4-Methodik + E7-Stimulus-
      // Sektionen) kann ~6-9k erreichen. 10000 gibt klare Marge vor einem
      // Truncation → Zod-Fail → fail-closed, ohne im Normalfall je gegriffen
      // zu werden (vormals 4096, zu knapp für die großen Fälle).
      maxTokens: 10_000,
      timeoutMs: 180_000,
      toolName: "emit_study_synthesis",
      toolDescription:
        "Return the cross-call study synthesis — overview, emergent themes and tensions, each grounded in verbatim quotes from the supplied insights.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      throw new StudySynthesisUnavailableError(
        "Claude synthesis returned invalid output twice",
        err,
      );
    }
    throw new StudySynthesisUnavailableError(
      "Claude synthesis call failed",
      err,
    );
  }

  // Anchored-filter (UNCHANGED): drop quotes/themes the model didn't ground in
  // the supplied insights — the synthesis anti-hallucination calibration, not
  // part of the transport change. E4 layert den Extras-Guard darüber:
  // methodology/signal_observations existieren nur, wenn ihre Input-Blöcke
  // tatsächlich geliefert wurden.
  const filtered = applyAnchoredFilter(raw, anchors);
  return sealSynthesisExtras(
    {
      ...filtered,
      // E7 — Sektionen gegen Mindest-N-Positionen + Anker-Haystack härten.
      stimulus_sections: filterStimulusSections(
        filtered.stimulus_sections,
        input.stimuli?.eligiblePositions ?? [],
        anchors,
      ),
    },
    Boolean(input.signals),
    Boolean(input.rationales && input.rationales.length > 0),
    Boolean(input.stimuli),
    Boolean(input.stimuli?.summary.preference),
  );
}

// ── DB-driven entry ─────────────────────────────────────────────────────────

export interface SynthesizeStudyResult {
  status: "synthesized" | "plan_not_found" | "no_insights";
  synthesis: StudySynthesisResult | null;
  basedOnCount: number;
  synthesizedAt: string | null;
  message: string | null;
}

/**
 * Full DB-driven entry point. Loads plan + insights, calls
 * synthesizeFromInputs, upserts study_synthesis on (org_id, plan_id).
 *
 * COST GUARDRAIL: we read ONLY the verdichteten Felder from
 * product_discovery_insights — not calls.transcript. The Stage-1 row
 * is the unit of input. Re-fetching transcripts would multiply token
 * cost without adding signal (Stage-1 already distilled what matters).
 */
export async function synthesizeStudy(
  orgId: string,
  planId: string,
  model: string = process.env.SYNTHESIS_MODEL ?? DEFAULT_SYNTHESIS_MODEL,
): Promise<SynthesizeStudyResult> {
  const supabase = createSynthSupabase();

  // Plan (for ground-context in the prompt). select("*") because supabase-js's
  // column-list parsing collapses to GenericStringError under the augmented
  // type; the row payload is tiny so `*` is no cost concern here.
  const { data: planRow, error: planErr } = await supabase
    .from("research_plans")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", planId)
    .maybeSingle();
  if (planErr || !planRow) {
    return {
      status: "plan_not_found",
      synthesis: null,
      basedOnCount: 0,
      synthesizedAt: null,
      message: "Research plan not found in this organization.",
    };
  }
  const plan: SynthesisPlanContext = {
    title: planRow.title,
    objective: planRow.objective,
    persona: planRow.persona,
    // M2: select the synthesis persona by study_type. Coerced defensively
    // (undefined pre-migration → 'product_discovery'), so a discovery plan
    // synthesizes byte-identically and only a market_research plan flips to the
    // market lens. Reuses plans-service.coerceStudyType (single source of truth).
    studyType: coerceStudyType(planRow.study_type),
    useCase: coerceUseCase((planRow as { use_case?: unknown }).use_case),
  };

  // Insights — `select("*")` for the same type-narrowing reason as the plan
  // read above. The Stage-1 row never carries the raw transcript (that
  // lives in calls.transcript, which we explicitly do NOT join here —
  // cost guardrail). So `*` is bounded.
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

  if (insightRows.length === 0) {
    return {
      status: "no_insights",
      synthesis: null,
      basedOnCount: 0,
      synthesizedAt: null,
      message:
        "No product_discovery_insights yet for this plan — nothing to synthesize.",
    };
  }

  const insights: SynthesisInsightInput[] = insightRows.map((r) => ({
    // We expose source_call_id as the ID the synthesizer cites — that's
    // the participant-identifying handle (one call = one respondent).
    // The insight row's own id is internal.
    id: r.source_call_id,
    summary: r.summary,
    featureRequests: (r.feature_requests as unknown as unknown[]) ?? [],
    painPoints: (r.pain_points as unknown as unknown[]) ?? [],
    themes: normalizeThemes(r.themes),
    respondentRole: r.respondent_role,
    respondentSegment: r.respondent_segment,
    sentiment: r.sentiment,
  }));

  // E4 — Signal-/Rationale-Inputs (Turn-Signale E1 + WHY-Rationales E3).
  // Fail-open im Loader: jeder Lesefehler ergibt null-Blöcke und die
  // Kern-Synthese läuft byte-identisch zu vor E4 (Plan §4.7: „kein neues
  // Datenmaterial, nur bereits abgeleitete Felder").
  const signalInputs = await loadSynthesisSignalInputs(orgId, planId);

  // E7 — Stimulus-Inputs (Set-Studien): Server-Zahlen + gedeckelte
  // Erstreaktions-Ausschnitte; Präferenz-Klassifikation (Haiku) läuft nur
  // ab Mindest-N Voll-Reveal-Sessions. Fail-open wie die Signal-Inputs.
  const stimulusInputs = await loadSynthesisStimulusInputs(orgId, planId);

  const synthesis = await synthesizeFromInputs(
    {
      plan,
      insights,
      signals: signalInputs.signals,
      rationales: signalInputs.rationales,
      rationaleCoverage: signalInputs.rationaleCoverage,
      stimuli: stimulusInputs.block,
    },
    model,
  );

  // Upsert on UNIQUE (org_id, plan_id) — re-run overwrites; no history.
  const synthesizedAt = new Date().toISOString();
  const { error: upsertErr } = await supabase
    .from("study_synthesis")
    .upsert(
      {
        org_id: orgId,
        plan_id: planId,
        overview: synthesis.overview,
        emergent_themes: synthesis.emergent_themes as unknown as Json,
        tensions: synthesis.tensions as unknown as Json,
        based_on_count: insights.length,
        synthesized_at: synthesizedAt,
        model,
      },
      { onConflict: "org_id,plan_id" },
    );

  if (upsertErr) {
    throw new StudySynthesisUnavailableError(
      `Failed to upsert study_synthesis: ${upsertErr.message}`,
    );
  }

  // E4 — die additiven Felder als best-effort Zweit-UPDATE (Muster E0-
  // Consent-Stempel): vor Anwendung der Migration 20260704000003 schlägt
  // NUR dieses UPDATE fehl (geloggt) — der Kern-Upsert oben bleibt der
  // unveränderte, harte Pfad. signals_summary trägt die SERVER-Zahlen
  // (signalInputs), signal_observations/methodology die LLM-Formulierungen;
  // die UI zeigt Kennzahlen ausschließlich aus signals_summary.
  const { error: extrasErr } = await supabase
    .from("study_synthesis")
    .update({
      methodology: synthesis.methodology as unknown as Json,
      signals_summary: (signalInputs.signals?.summary ?? null) as unknown as Json,
      signal_observations: synthesis.signal_observations as unknown as Json,
      // E7 — stimulus_summary trägt die SERVER-Zahlen (auch unter Mindest-N,
      // für die ehrliche „noch zu wenige Interviews"-Anzeige); sections/
      // comparison sind die geharteten LLM-Formulierungen.
      stimulus_summary: (stimulusInputs.summary ?? null) as unknown as Json,
      stimulus_sections: synthesis.stimulus_sections as unknown as Json,
      stimulus_comparison: synthesis.stimulus_comparison,
    })
    .eq("org_id", orgId)
    .eq("plan_id", planId);
  if (extrasErr) {
    console.warn(
      `[synthesis] extras update failed (migrations 20260704000003 + 20260714000001 applied?): ${extrasErr.message}`,
    );
  }

  return {
    status: "synthesized",
    synthesis,
    basedOnCount: insights.length,
    synthesizedAt,
    message: null,
  };
}

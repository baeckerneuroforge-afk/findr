/**
 * Study-Synthesis (Stage 2) prompts. Mirrors src/lib/product-discovery/
 * prompts.ts conventions: system prompt with explicit posture + detect rules,
 * user prompt assembled from verdichtete inputs, JSON-only output validated
 * by Zod against StudySynthesisResultSchema.
 *
 * COST GUARDRAIL: the user prompt MUST carry only the verdichteten Felder
 * (feature_requests / pain_points / themes / summary / respondent metadata),
 * NEVER the raw transcripts. Transcripts have already been distilled by
 * Stage 1; re-sending them would multiply the token cost without adding
 * signal. The buildSynthesisUserPrompt below enforces this contract.
 */

// Type-only import (fully erased at compile time — does NOT pull in
// research/db.ts's `server-only` runtime side-effect, so this stays a pure
// string-building module the eval harness can import). Reuses the canonical
// study_type union rather than redeclaring it.
import type { ResearchPlanStudyType } from "@/lib/research/db";

/** Input row for the synthesizer — one per Stage-1 insight that belongs
 *  to the study being synthesized. The engine assembles these from
 *  product_discovery_insights WHERE org_id = X AND plan_id = Y.
 *
 *  source_call_id (NOT source_insight_id) is what we expose as the
 *  "id" string to the LLM, because that's the participant-identifying
 *  handle on the row. The Stage-1 row's own id is internal. */
export interface SynthesisInsightInput {
  /** Stable string id we ask the LLM to cite — typically the
   *  product_discovery_insights.source_call_id (one call = one
   *  respondent). Could equally be the insight row id; the engine
   *  builds a Set of these and rejects emergent_themes that cite
   *  unknown ids. */
  id: string;
  /** Stage-1 summary text (one paragraph per insight). */
  summary: string | null;
  /** Stage-1 feature_requests + pain_points + themes JSON arrays —
   *  passed through as-is so the synthesizer can read the per-item
   *  evidence (verbatim quotes) and titles. */
  featureRequests: unknown[];
  painPoints: unknown[];
  themes: unknown[];
  /** Respondent metadata from the 20260616 migration. Powers the
   *  segmented synthesis ("3 of 5 founders said …"). */
  respondentRole: string | null;
  respondentSegment: string | null;
  sentiment: "positive" | "neutral" | "negative" | "mixed" | null;
}

/** Plan-level context the synthesizer needs to ground language ("this
 *  study was about onboarding") — not the only thing it has to write
 *  about, but the anchor. */
export interface SynthesisPlanContext {
  title: string;
  objective: string;
  persona: string | null;
  /** Studientyp-Diskriminator (Phase M0) — selects the synthesis PERSONA, not
   *  the structure (M2). 'market_research' runs the market-analyst lens
   *  (MARKET_STUDY_SYNTHESIS_SYSTEM_PROMPT); everything else — including
   *  `undefined`, which is what the existing eval cases and any pre-M2 caller
   *  pass — runs the byte-identical product-discovery persona
   *  (STUDY_SYNTHESIS_SYSTEM_PROMPT). Optional so the discovery path stays
   *  literally unchanged: the user prompt never references it, only
   *  selectSynthesisSystemPrompt does. */
  studyType?: ResearchPlanStudyType;
}

export interface SynthesisInput {
  plan: SynthesisPlanContext;
  insights: SynthesisInsightInput[];
}

export const STUDY_SYNTHESIS_SYSTEM_PROMPT = `You are a senior B2B research analyst synthesizing the FINDINGS of a multi-interview study. Your inputs are the per-interview verdichtungen (NOT the raw transcripts — they already exist downstream) produced by a Stage-1 classifier. Your job is to find what is true ACROSS interviews — emergent themes and real tensions — and to write a short overview.

POSTURE — Synthesis, NOT invention.
- You report ONLY what the input verdichtungen actually contain. If 3 of 8 respondents share a concern, that's a theme with frequency 3. If all 8 agree, there are zero tensions — full stop.
- NEVER manufacture a theme to fill space. Empty emergent_themes is the correct answer for sparse / incoherent input sets, not "let's stretch".
- NEVER manufacture a counter-side to balance a theme. A tension exists ONLY when two distinct groups of respondents take genuinely opposing positions. "5 say X, 0 say not-X" is NOT a tension — it's a strong theme with zero tension.
- Every emergent_theme MUST cite source_insight_ids — the IDs of the input insights that carry the signal. Same for both sides of a tension. Themes without source ids are hallucinations and will be rejected at the persistence boundary.

ANCHORING RULES (the engine will RE-CHECK these post-parse and drop themes that fail):
- Every id in sourceInsightIds MUST be an id that appeared in the input set. Don't invent ids.
- Every quote MUST be a verbatim string lifted from a feature_request.evidence, pain_point.evidence, or theme.summary in the input. Don't paraphrase. The engine matches with typography folding (umlauts, smart quotes, dashes) so spelling-equivalent quotes count — semantic-equivalent ones do not.
- frequency MUST equal the count of DISTINCT sourceInsightIds for that theme. The engine will override your number with the computed truth, but matching it the first time means you understood the rule.
- The two sides of a tension MUST have DISJOINT sourceInsightIds. The same respondent can't legitimately appear on both sides of the same disagreement.

WHAT YOU OUTPUT — three layers:

1. OVERVIEW — 2-4 sentences, the synthesis "above the fold". What did this study surface in CROSS-CALL language? Read the inputs, then write what a smart researcher would tell their team in 30 seconds. NOT a list, NOT a quote, NOT a per-respondent breakdown — the conceptual finding.

2. EMERGENT_THEMES — themes that show in ≥2 respondents. Each:
   - title: short label in cross-call language ("Onboarding-Friction für neue Admin-User")
   - summary: 1-3 sentences of YOUR framing of the shared concern
   - frequency: number of distinct respondents carrying it
   - sourceInsightIds: which input IDs carry it
   - quotes: 1-5 verbatim quotes pulled from those inputs (from evidence arrays). Pick quotes that illustrate the theme; don't duplicate-cite the same line twice.

3. TENSIONS — places where respondents DISAGREE. Each:
   - description: 1-2 sentences naming the disagreement at the conceptual level (what is being argued about)
   - side_a: { label, sourceInsightIds, quotes }
   - side_b: { label, sourceInsightIds, quotes }
   The labels should name the POSITIONS ("wants native mobile app" vs "prefers browser-only"), not the people. Both sides MUST have distinct respondent groups.

WHEN THERE IS NOTHING TO SAY:
- Only 1 respondent in the input → emergent_themes: [], tensions: [], overview describes the single voice as a single voice. Do NOT claim a theme from n=1.
- All respondents agree → tensions: []. Strong themes, no fake counter-side.
- Inputs are empty / off-topic → emergent_themes: [], tensions: [], overview says so honestly in 1 sentence.

OUTPUT — return ONLY this JSON object, no markdown, no preamble:

{
  "overview": "<2-4 sentences>",
  "emergent_themes": [
    {
      "title": "<short label>",
      "summary": "<1-3 sentences>",
      "frequency": <int>,
      "sourceInsightIds": ["<id>", ...],
      "quotes": ["<verbatim quote>", ...]
    }
  ],
  "tensions": [
    {
      "description": "<1-2 sentences>",
      "side_a": { "label": "<position>", "sourceInsightIds": ["<id>", ...], "quotes": ["<quote>", ...] },
      "side_b": { "label": "<position>", "sourceInsightIds": ["<id>", ...], "quotes": ["<quote>", ...] }
    }
  ]
}`;

/**
 * Market-Research synthesis persona (Phase M2). A faithful VARIANT of
 * STUDY_SYNTHESIS_SYSTEM_PROMPT for study_type='market_research': the SAME
 * anchoring contract, the SAME three-layer output (overview / emergent_themes /
 * tensions), the SAME output JSON shape — and therefore the SAME
 * StudySynthesisResultSchema and the SAME engine-side anchored-filter. Only the
 * PERSONA and the LENS differ (separation plan §5, M2):
 *
 *  - The analyst is a market & consumer researcher, not a B2B product analyst.
 *  - The synthesis condenses MARKET signal — price lager(s), purchase-intent
 *    pattern, market segments, competitive perception — not feature/pain.
 *  - It is told the per-interview findings arrive under the shared-table field
 *    name "feature_requests" (M1 reuse decision §9 #1) and to read them as
 *    market findings (PRICE_SENSITIVITY / PURCHASE_INTENT / COMPETITIVE_
 *    PERCEPTION / SEGMENT_NEED / BRAND_PERCEPTION), with "pain_points" empty.
 *
 * The structure is shared (separation-plan Ebene 3): the emergent-theme /
 * tension surface is already type-agnostic, so this widens the LENS, not the
 * schema. selectSynthesisSystemPrompt() routes to this by study_type; the
 * product-discovery path keeps STUDY_SYNTHESIS_SYSTEM_PROMPT byte-identical.
 */
export const MARKET_STUDY_SYNTHESIS_SYSTEM_PROMPT = `You are a senior market & consumer research analyst synthesizing the FINDINGS of a multi-interview MARKET study. Your inputs are the per-interview verdichtungen (NOT the raw transcripts — they already exist downstream) produced by a Stage-1 MARKET classifier. Your job is to find what is true ACROSS the respondents — the shared market signal and the real disagreements between market segments — and to write a short overview. You work in the DACH market; reproduce quotes VERBATIM in their original language (German or English) and write YOUR prose in German.

INPUT SHAPE — read the coded findings as MARKET signal.
- Each interview's coded findings arrive in a JSON field named "feature_requests" — that is a shared-table STORAGE name, not a product-feedback signal. Read every entry there as a MARKET finding carrying one of these categories: PRICE_SENSITIVITY (willingness-to-pay, price thresholds, value-for-money), PURCHASE_INTENT (intent to buy / switch / adopt, the decision trigger), COMPETITIVE_PERCEPTION (how respondents see competitors / the category landscape), SEGMENT_NEED (an unmet need at the market / population level), BRAND_PERCEPTION (attitude toward the brand / category / concept).
- "pain_points" is empty on a market study — ignore it. The respondent metadata (role / segment / sentiment) describes a MARKET respondent ("Elternteil, urban", "SMB-Eigentümer DACH"), who often has no relationship to the subject at all.

POSTURE — Synthesis, NOT invention.
- You report ONLY what the input findings actually contain. If 3 of 8 respondents name the same price ceiling, that's a theme with frequency 3. If all 8 share a perception, there are zero tensions — full stop.
- NEVER manufacture a theme to fill space. Empty emergent_themes is the correct answer for sparse / incoherent input sets, not "let's stretch".
- NEVER invent a willingness-to-pay number, a market segment, or a competitor the findings do not contain. NEVER manufacture a counter-side to balance a theme. A tension exists ONLY when two distinct groups of respondents take genuinely opposing positions (e.g. price-sensitive vs. premium-willing). "5 say X, 0 say not-X" is NOT a tension — it's a strong theme with zero tension.
- Every emergent_theme MUST cite source_insight_ids — the IDs of the input insights that carry the signal. Same for both sides of a tension. Themes without source ids are hallucinations and will be rejected at the persistence boundary.

ANCHORING RULES (the engine will RE-CHECK these post-parse and drop themes that fail):
- Every id in sourceInsightIds MUST be an id that appeared in the input set. Don't invent ids.
- Every quote MUST be a verbatim string lifted from a finding's evidence (in the "feature_requests" array) or a theme.summary in the input. Don't paraphrase. The engine matches with typography folding (umlauts, smart quotes, dashes) so spelling-equivalent quotes count — semantic-equivalent ones do not.
- frequency MUST equal the count of DISTINCT sourceInsightIds for that theme. The engine will override your number with the computed truth, but matching it the first time means you understood the rule.
- The two sides of a tension MUST have DISJOINT sourceInsightIds. The same respondent can't legitimately appear on both sides of the same disagreement.

WHAT YOU OUTPUT — three layers:

1. OVERVIEW — 2-4 sentences, the market synthesis "above the fold". What did this study surface about the MARKET in cross-respondent language — the price lager(s), the purchase-intent pattern, the segments, the competitive perception? Read the inputs, then write what a smart market researcher would tell their team in 30 seconds. NOT a list, NOT a quote, NOT a per-respondent breakdown — the conceptual market finding.

2. EMERGENT_THEMES — shared market positions carried by ≥2 respondents. Each:
   - title: short label in cross-respondent market language ("Preis als Haupthürde im SMB-Segment", "Wechselbereitschaft bei besserem Support")
   - summary: 1-3 sentences of YOUR framing of the shared market signal
   - frequency: number of distinct respondents carrying it
   - sourceInsightIds: which input IDs carry it
   - quotes: 1-5 verbatim quotes pulled from those inputs (from the findings' evidence arrays). Pick quotes that illustrate the theme; don't duplicate-cite the same line twice.

3. TENSIONS — places where market segments DISAGREE. Each:
   - description: 1-2 sentences naming the disagreement at the conceptual level (what the segments are split about — price tolerance, brand trust, the trigger to switch)
   - side_a: { label, sourceInsightIds, quotes }
   - side_b: { label, sourceInsightIds, quotes }
   The labels should name the POSITIONS ("zahlt nur unter 20 €/Monat" vs "zahlt Premium für Qualität"), not the people. Both sides MUST have distinct respondent groups.

WHEN THERE IS NOTHING TO SAY:
- Only 1 respondent in the input → emergent_themes: [], tensions: [], overview describes the single voice as a single voice. Do NOT claim a theme from n=1.
- All respondents agree → tensions: []. Strong themes, no fake counter-side.
- Inputs are empty / off-topic → emergent_themes: [], tensions: [], overview says so honestly in 1 sentence.

OUTPUT — return ONLY this JSON object, no markdown, no preamble:

{
  "overview": "<2-4 sentences>",
  "emergent_themes": [
    {
      "title": "<short label>",
      "summary": "<1-3 sentences>",
      "frequency": <int>,
      "sourceInsightIds": ["<id>", ...],
      "quotes": ["<verbatim quote>", ...]
    }
  ],
  "tensions": [
    {
      "description": "<1-2 sentences>",
      "side_a": { "label": "<position>", "sourceInsightIds": ["<id>", ...], "quotes": ["<quote>", ...] },
      "side_b": { "label": "<position>", "sourceInsightIds": ["<id>", ...], "quotes": ["<quote>", ...] }
    }
  ]
}`;

/**
 * Select the Stage-2 synthesis persona by study_type. Market lens for
 * 'market_research'; the byte-identical product-discovery lens for everything
 * else — INCLUDING `undefined` (the existing eval cases + any pre-M2 caller).
 * Both personas share the same anchoring contract AND the same output schema;
 * only the persona text differs. This is the entire M2 synthesis change: one
 * branch, no structural divergence (separation plan §5, M2).
 */
export function selectSynthesisSystemPrompt(
  studyType?: ResearchPlanStudyType,
): string {
  return studyType === "market_research"
    ? MARKET_STUDY_SYNTHESIS_SYSTEM_PROMPT
    : STUDY_SYNTHESIS_SYSTEM_PROMPT;
}

function formatInsight(insight: SynthesisInsightInput): string {
  const lines: string[] = [
    `INSIGHT id=${insight.id}`,
    `  respondent: role=${insight.respondentRole ?? "—"}, segment=${
      insight.respondentSegment ?? "—"
    }, sentiment=${insight.sentiment ?? "—"}`,
  ];
  if (insight.summary && insight.summary.trim() !== "") {
    lines.push(`  summary: ${insight.summary.trim()}`);
  }
  if (insight.featureRequests.length > 0) {
    lines.push(
      `  feature_requests: ${JSON.stringify(insight.featureRequests)}`,
    );
  }
  if (insight.painPoints.length > 0) {
    lines.push(`  pain_points: ${JSON.stringify(insight.painPoints)}`);
  }
  if (insight.themes.length > 0) {
    lines.push(`  themes: ${JSON.stringify(insight.themes)}`);
  }
  return lines.join("\n");
}

export function buildSynthesisUserPrompt(input: SynthesisInput): string {
  const planLines = [
    `STUDY PLAN`,
    `Title:     ${input.plan.title}`,
    `Objective: ${input.plan.objective}`,
  ];
  if (input.plan.persona && input.plan.persona.trim() !== "") {
    planLines.push(`Persona:   ${input.plan.persona.trim()}`);
  }

  const insightsBlock =
    input.insights.length === 0
      ? "(no insights to synthesize — return empty themes + empty tensions + a one-sentence overview that says so)"
      : input.insights.map(formatInsight).join("\n\n");

  return `${planLines.join("\n")}

INPUT INSIGHTS (${input.insights.length}):

${insightsBlock}

Return your synthesis as JSON only.`;
}

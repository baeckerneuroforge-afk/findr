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
import type {
  ResearchPlanStudyType,
  ResearchPlanUseCase,
} from "@/lib/research/db";
// Type-only (erased) — zieht signals.ts' `server-only` NICHT in dieses pure
// String-Modul; der Eval-Harness kann prompts.ts weiterhin direkt importieren.
import type {
  SessionRationales,
  SignalsPromptBlock,
} from "./signals";

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
  /** Optional method lens for market-research synthesis. It affects only the
   *  additive Stage-2 system-prompt focus; the user prompt and Stage-1 inputs
   *  stay unchanged. */
  useCase?: ResearchPlanUseCase | null;
}

export interface SynthesisInput {
  plan: SynthesisPlanContext;
  insights: SynthesisInsightInput[];
  /** E4 — SERVER-berechneter Turn-Signal-Faktenblock (E1). Optional/null →
   *  der Prompt trägt keinen Signal-Block und die Engine erzwingt leere
   *  signal_observations. Nur ≥ Mindest-N geliefert (signals.ts). */
  signals?: SignalsPromptBlock | null;
  /** E4 — echte WHY-Begründungen (E3) je Session, Frage-Reihenfolge.
   *  Optional/null → kein Methodik-Block, methodology wird null erzwungen. */
  rationales?: SessionRationales[] | null;
  /** E4 — Coverage für die ehrliche Methodik-Note („Begründungen lagen für
   *  X von Y Interviews vor"). Nur gesetzt, wenn rationales gesetzt ist. */
  rationaleCoverage?: { withRationales: number; totalSessions: number } | null;
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

export const MARKET_SYNTHESIS_USE_CASE_FOCUS: Record<
  ResearchPlanUseCase,
  string
> = {
  general_survey:
    "Fokus: Bedarf und Pain Points als wiederkehrendes Marktproblem verdichten, ergänzt um Preis-Lager und belastbare Kaufabsicht. Betone SEGMENT_NEED, PRICE_SENSITIVITY und PURCHASE_INTENT; Komplimente oder hypothetische Zustimmung zählen nicht als Kaufsignal, konkrete aktuelle Lösungen, Aufwand und Commitment schon. Realistische Tensions liegen zwischen klar getrennten Bedarfs-, Preis- oder Kaufbereitschaftspositionen; ohne opponierende Gruppen keine Tension.",
  brand_research:
    "Fokus: spontane Assoziationen, Bilder, Gefühle und Worte zur Marke verdichten, plus Vergleiche, Differenzierung und Wettbewerbsbild. Betone BRAND_PERCEPTION und COMPETITIVE_PERCEPTION und halte die Synthese flach: wiederkehrende Wahrnehmungsmuster und klar gegensätzliche Markenbilder statt Verhaltensdeutung. Eine Preis- oder Pain-Tension ist hier untypisch; erfinde sie nicht, wenn die Inputs kein entsprechendes Signal tragen.",
  creative_test:
    "Fokus: Botschaftsklarheit, erster spontaner Eindruck, emotionale Wirkung und Markenfit verdichten; ordne Gestaltungselemente nur dann einer Wirkung zu, wenn die Inputs das tragen. Betone BRAND_PERCEPTION und, wo tatsächlich verglichen wird, COMPETITIVE_PERCEPTION. Halte die Synthese flach: realistische Tensions betreffen unterschiedliche Deutungen oder Wirkungen der Botschaft, nicht erzwungene Kaufabsicht oder Pain.",
  concept_test:
    "Fokus: zuerst gemeinsames und abweichendes Verständnis des Konzepts verdichten, danach Relevanz, wahrgenommenen Nutzen und belastbare Kaufabsicht. Betone SEGMENT_NEED, PURCHASE_INTENT und BRAND_PERCEPTION; hypothetische Zustimmung zählt schwächer als aktuelles Verhalten, Commitment oder begründete Präferenz. Realistische Tensions liegen zwischen unterschiedlichen Konzeptverständnissen, Relevanzurteilen oder Adoptionspositionen; Verständnis kommt vor Nutzen.",
};

/**
 * Select the Stage-2 synthesis persona by study_type and, for market studies,
 * append the method focus selected by use_case. The product-discovery lens
 * remains byte-identical for every use_case; market_research without use_case
 * also returns the byte-identical market base prompt. All variants share the
 * same anchoring contract and output schema.
 */
export function selectSynthesisSystemPrompt(
  studyType?: ResearchPlanStudyType,
  useCase?: ResearchPlanUseCase | null,
): string {
  if (studyType !== "market_research") {
    return STUDY_SYNTHESIS_SYSTEM_PROMPT;
  }
  return useCase
    ? `${MARKET_STUDY_SYNTHESIS_SYSTEM_PROMPT}\n\nUSE-CASE FOCUS:\n${MARKET_SYNTHESIS_USE_CASE_FOCUS[useCase]}`
    : MARKET_STUDY_SYNTHESIS_SYSTEM_PROMPT;
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

/** E4 — rendert den Turn-Signal-Faktenblock (server-berechnete Zahlen) samt
 *  der Formulierungs-Regeln für signal_observations. Pure string-building. */
function formatSignalsBlock(signals: SignalsPromptBlock): string {
  const s = signals.summary;
  const affects = Object.entries(s.affects)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  const aspects =
    signals.openAspects.length > 0
      ? signals.openAspects.map((a) => `"${a}"`).join(", ")
      : "(none recorded)";
  return `TURN SIGNALS (SERVER-COMPUTED FACTS — text-derived conversational hints, never judgments about persons):
- sessions with signal data: ${s.signalSessions} of ${s.totalSessions} completed interviews
- answers labeled: ${s.totalAnswers} total — direct=${s.direct}, partial=${s.partial}, evasive=${s.evasive}, declined=${s.declined}
- non-neutral affect counts: ${affects || "(none)"}
- aspects left open in non-direct answers: ${aspects}

RULES for "signal_observations" (max 3):
- Ground every observation EXCLUSIVELY in the facts above; copy counts verbatim — never recompute, never extrapolate.
- Phrase as text-derived hints ("Bei Preisfragen wichen 4 von ${s.totalAnswers} Antworten aus"), never as judgments about persons. 'declined' is a legitimate answer, not a deficiency.
- Skip observations the facts don't clearly support — fewer, well-grounded observations beat three stretched ones.`;
}

/** E4 — rendert die echten Frage-Begründungen (E3 WHY) je Session samt der
 *  Aggregations-Regeln für den methodology-Abschnitt. */
function formatRationalesBlock(
  rationales: SessionRationales[],
  coverage: { withRationales: number; totalSessions: number } | null,
): string {
  const sessions = rationales
    .map(
      (r) =>
        `${r.sessionLabel}: ${r.rationales.map((x, i) => `(${i + 1}) ${x}`).join(" ")}`,
    )
    .join("\n");
  const coverageLine = coverage
    ? `coverage: rationales recorded for ${coverage.withRationales} of ${coverage.totalSessions} completed interviews`
    : "";
  return `QUESTION RATIONALES (the interviewer's REAL per-question reasons, recorded at decision time — E3 WHY header; per session, in asking order):
${sessions}
${coverageLine}

RULES for "methodology" („Warum wurde was gefragt?"):
- Aggregate the rationales THEMATICALLY (lines of questioning), never question-by-question; ground every statement ONLY in the rationales above.
- summary: 2-3 sentences on how the interviewer steered the study. themes: up to 8 {topic, rationale} lines.
- coverageNote: when rationales are missing for some interviews, state it honestly in the synthesis language (e.g. "Begründungen lagen für ${coverage ? coverage.withRationales : "X"} von ${coverage ? coverage.totalSessions : "Y"} Interviews vor — ältere Sessions wurden vor Einführung der Begründungen geführt."). Null when coverage is complete.
- Method-focused, never judgments about participants.`;
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

  // E4 — beide Blöcke sind strikt additiv: fehlen sie (null/undefined), ist
  // der Prompt byte-identisch zu vor E4 und die Engine erzwingt
  // methodology=null + signal_observations=[].
  const extraBlocks: string[] = [];
  if (input.signals) {
    extraBlocks.push(formatSignalsBlock(input.signals));
  }
  if (input.rationales && input.rationales.length > 0) {
    extraBlocks.push(
      formatRationalesBlock(input.rationales, input.rationaleCoverage ?? null),
    );
  }
  const extras =
    extraBlocks.length > 0 ? `\n\n${extraBlocks.join("\n\n")}` : "";

  return `${planLines.join("\n")}

INPUT INSIGHTS (${input.insights.length}):

${insightsBlock}${extras}

Return your synthesis as JSON only.`;
}

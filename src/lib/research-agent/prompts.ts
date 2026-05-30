import type { EmergentTheme, Tension } from "@/lib/schemas/synthesis";

/**
 * Research-Agent prompt + data-section assembly. Pure string-building, no
 * `server-only` and no network — so the eval harness can import the input
 * shapes from here exactly like evals-synthesis imports SynthesisInput from
 * synthesis/prompts. The engine (research-agent/engine.ts) owns the Anthropic
 * call + the anchor filter; this file owns WHAT the model sees.
 */

// ── Pure-input shapes (the eval entry) ──────────────────────────────────────

/** The agent's evidence: a finished study synthesis. Mirrors the content
 *  fields of StudySynthesisRecord (overview / emergent_themes / tensions /
 *  based_on_count) — themes + tensions arrive already normalized by
 *  getStudySynthesis, so inner fields are guaranteed present. */
export interface ResearchAgentSynthesisInput {
  overview: string | null;
  emergent_themes: EmergentTheme[];
  tensions: Tension[];
  /** Total interviews the synthesis was built on. A respondent count in the
   *  deliverable may NEVER exceed this. */
  basedOnCount: number;
}

/** Framing only — the agent must NOT derive a finding from plan metadata. */
export interface ResearchAgentPlanContext {
  title: string;
  objective: string;
  persona: string | null;
}

export interface ResearchAgentFromInputs {
  plan: ResearchAgentPlanContext | null;
  synthesis: ResearchAgentSynthesisInput;
  instruction: string;
}

// ── System prompt (posture + anchoring contract) ────────────────────────────

/**
 * Posture only — the synthesis data is appended via
 * buildResearchAgentDataSection() so the stable prefix can be prompt-cached
 * across multiple instructions on the same study. The instruction itself goes
 * in the user message.
 */
export const RESEARCH_AGENT_SYSTEM_PROMPT = `You are a careful B2B research analyst building a DELIVERABLE for a researcher from ONE finished study synthesis. The researcher gives you an instruction ("fasse die Hauptbefunde als 5 Bullet-Points zusammen", "welche 3 Themen sind am wichtigsten und warum", "mach einen Breakdown der Spannungen") and you produce a STRUCTURED deliverable — STRICTLY from the synthesis supplied in the SECTIONS below.

WHAT YOU HAVE: the cross-call SYNTHESIS of a single study — an overview, a set of emergent themes (each with a title, a summary, a respondent frequency, and verbatim quotes), and a set of tensions (two-sided disagreements; each side has a label and verbatim quotes). The STUDY CONTEXT (title / objective / persona) is FRAMING ONLY — it is NOT evidence; never derive a finding from it.

POSTURE — Build ONLY from the synthesis.
- You do NOT have the raw interview transcripts. The synthesis IS the data.
- You have NO general knowledge about this product, this market, or this company. If the synthesis doesn't say it, you don't know it.
- NEVER invent a finding, a theme, a tension, a number, a respondent segment, or a quote. NEVER paraphrase a quote into something the synthesis doesn't literally contain.
- NEVER translate quotes — reproduce them VERBATIM in their original language.
- Numbers: a respondent count may NEVER exceed the study's interview count (shown as "based on N interviews"). Use the frequency the synthesis gives for a theme; never invent, round up, or inflate a count.

CLASSIFY the instruction into exactly ONE deliverableType:
- "summary"        — condense the findings (bullet points, a management summary).
- "breakdown"      — split the findings along a dimension the synthesis ACTUALLY supports (e.g. by theme, or by the two sides of each tension). If the instruction asks to break down along a dimension the synthesis has no data for (price tier, region, tenure, …), that is NOT answerable — refuse (see below).
- "theme_ranking"  — rank themes / findings by importance, each with a rationale.
- "custom"         — any other answerable deliverable (a headline, a single key takeaway, …).
Pick the single best-fitting type. If genuinely unsure, use "custom".

ANCHORING (the engine RE-CHECKS this after you answer and DROPS unanchored items; a deliverable whose items are ALL dropped is downgraded to fulfilled=false — so an unanchored deliverable is worse than an honest refusal):
- EVERY item MUST carry at least one anchor: a themeRef (a VERBATIM emergent-theme title or tension description, copied from the synthesis) OR a quote (a VERBATIM substring of the synthesis text). An item with no anchor will be dropped.
- themeRefs: copy the theme title / tension description VERBATIM — do not rephrase or shorten it.
- quotes: copy verbatim from the synthesis (a theme quote, a tension-side quote, or a phrase from the overview). The engine matches with typography folding (umlauts, smart quotes, en/em dashes, whitespace), so spelling-equivalents pass — semantic-equivalents do NOT.
- Write all of YOUR prose (item.text, headings, title, note) in German; keep the anchored quotes in their original language.

WHEN THE INSTRUCTION CANNOT BE FULFILLED from the synthesis (it asks for a dimension the synthesis doesn't have, a data source that isn't this study, or a fact never surfaced):
- Return fulfilled=false, an EMPTY items array, and a 1-sentence honest German note — e.g. "Dazu liegt in dieser Synthese keine Evidenz vor." or a specific variant ("Die Synthese enthält keine Preis-Information; ein Breakdown nach Preis-Tier ist daraus nicht möglich.").
- Do NOT manufacture a thin deliverable to fill the field. Do NOT bridge to a general best practice. Do NOT extrapolate one mention into a pattern.

WHEN YOU CAN FULFILL IT (fulfilled=true):
- Produce the deliverable as \`items\`. Each item = { heading, text, themeRefs, quotes }. Use \`heading\` for a short label (a bullet headline, a ranked theme's name, a breakdown part) and \`text\` for the German prose. Anchor EACH item.
- Give the deliverable a short \`title\` (e.g. "Hauptbefunde", "Theme-Ranking", "Breakdown der Spannungen") and leave \`note\` empty.
- Honor the requested SHAPE: "5 Bullet-Points" → ~5 items; a ranking → ordered items each with a rationale; a breakdown → one item per part.

OUTPUT — return ONLY this JSON object, no markdown, no preamble:

{
  "fulfilled": <bool>,
  "deliverableType": "summary" | "breakdown" | "theme_ranking" | "custom",
  "title": "<short German title, or empty on refusal>",
  "items": [
    { "heading": "<short label or empty>", "text": "<German prose>", "themeRefs": ["<verbatim theme title / tension description>"], "quotes": ["<verbatim quote>"] }
  ],
  "note": "<empty when fulfilled=true; a 1-sentence honest German refusal when fulfilled=false>"
}`;

// ── Data-section assembly ───────────────────────────────────────────────────

function formatTheme(theme: EmergentTheme, idx: number): string {
  const lines = [
    `THEME ${idx}: "${theme.title}" (frequency=${theme.frequency})`,
    `  summary: ${theme.summary}`,
  ];
  if (theme.quotes.length > 0) {
    lines.push(`  quotes: ${theme.quotes.map((q) => `"${q}"`).join(" | ")}`);
  }
  return lines.join("\n");
}

function formatTensionSideLine(
  side: { label: string; quotes: string[] },
  which: "a" | "b",
): string {
  const base = `  side_${which} "${side.label}"`;
  return side.quotes.length > 0
    ? `${base}: ${side.quotes.map((q) => `"${q}"`).join(" | ")}`
    : base;
}

function formatTension(tension: Tension, idx: number): string {
  return [
    `TENSION ${idx}: ${tension.description}`,
    formatTensionSideLine(tension.side_a, "a"),
    formatTensionSideLine(tension.side_b, "b"),
  ].join("\n");
}

/**
 * The data section appended to the system prompt. STUDY CONTEXT is marked as
 * framing-only; only the SYNTHESIS block is evidence (and only the SYNTHESIS
 * strings go into the engine's anchor haystack).
 */
export function buildResearchAgentDataSection(
  input: ResearchAgentFromInputs,
): string {
  const blocks: string[] = [];

  if (input.plan) {
    const ctx = [
      "STUDY CONTEXT (framing only — NOT evidence)",
      `Title:     ${input.plan.title}`,
      `Objective: ${input.plan.objective}`,
    ];
    if (input.plan.persona && input.plan.persona.trim() !== "") {
      ctx.push(`Persona:   ${input.plan.persona.trim()}`);
    }
    blocks.push(ctx.join("\n"));
  }

  const s = input.synthesis;
  const synth: string[] = [
    `SYNTHESIS (the ONLY evidence — based on ${s.basedOnCount} interviews)`,
  ];
  if (s.overview && s.overview.trim() !== "") {
    synth.push(`\noverview: ${s.overview.trim()}`);
  }
  if (s.emergent_themes.length > 0) {
    synth.push(`\nEMERGENT THEMES (${s.emergent_themes.length}):`);
    s.emergent_themes.forEach((t, i) => synth.push(formatTheme(t, i + 1)));
  }
  if (s.tensions.length > 0) {
    synth.push(`\nTENSIONS (${s.tensions.length}):`);
    s.tensions.forEach((t, i) => synth.push(formatTension(t, i + 1)));
  }
  if (
    s.emergent_themes.length === 0 &&
    s.tensions.length === 0 &&
    (!s.overview || s.overview.trim() === "")
  ) {
    synth.push(
      "(this synthesis is empty — fulfilled=false for any instruction)",
    );
  }
  blocks.push(synth.join("\n"));

  return blocks.join("\n\n");
}

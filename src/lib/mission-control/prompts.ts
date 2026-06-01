import type { EmergentTheme, Tension } from "@/lib/schemas/synthesis";
import type { MissionControlHistoryTurn } from "@/lib/schemas/mission-control";
import type { ResearchPlanStudyType } from "@/lib/research/db";

/**
 * Mission-Control prompt + data-section assembly. Pure string-building, no
 * `server-only` and no network — so the eval harness can import the input
 * shapes from here exactly like evals-research-agent imports its FromInputs
 * shapes from research-agent/prompts. The engine (mission-control/engine.ts)
 * owns the Anthropic call + the per-study anchor filter; this file owns WHAT
 * the model sees.
 */

// ── Pure-input shapes (the eval entry) ──────────────────────────────────────

/** One study's finished synthesis — the cross-study evidence unit. Mirrors the
 *  content fields of StudySynthesisRecord (overview / emergent_themes /
 *  tensions / based_on_count); themes + tensions arrive already normalized
 *  (getStudySynthesis / loadOrgSyntheses), so inner fields are guaranteed
 *  present and safe to iterate. */
export interface MissionControlSynthesisInput {
  /** plan_id — the stable per-study attribution handle the model must cite and
   *  the engine validates each citation against. */
  studyId: string;
  /** research_plans.title — the human study name. FRAMING for the model and
   *  the display label; deliberately NOT part of the anchor haystack (it is
   *  metadata, not a finding). */
  studyTitle: string;
  overview: string | null;
  emergent_themes: EmergentTheme[];
  tensions: Tension[];
  /** Interviews this study's synthesis was built on. A respondent count for
   *  this study may never exceed it. */
  basedOnCount: number;
  /** Studientyp (M2) — surfaces "Markt-Studie" vs "Discovery-Studie" as a
   *  DISPLAY/FRAMING label so a cross-study answer can tell the kinds apart.
   *  Deliberately NOT part of the anchor haystack (same status as studyTitle —
   *  metadata, not a finding). OPTIONAL: the eval fixtures + any pre-M2 caller
   *  leave it undefined, which renders no label and keeps those prompts
   *  byte-identical; loadOrgSyntheses populates it in production. ONE table,
   *  ONE path — this is a label, not a second data source. */
  studyType?: ResearchPlanStudyType;
}

export interface MissionControlFromInputs {
  /** The UNION of the org's study syntheses — the entire cross-study haystack. */
  syntheses: MissionControlSynthesisInput[];
  question: string;
  /** Prior conversation turns (multi-turn). Threaded into the Anthropic
   *  messages as context; NEVER folded into the anchor haystack. */
  history?: MissionControlHistoryTurn[];
}

// ── System prompt (posture + cross-study anchoring contract) ─────────────────

/**
 * Posture only — the study syntheses are appended via
 * buildMissionControlDataSection() so the stable prefix can be prompt-cached
 * across the turns of one cross-study chat. The question goes in the user
 * message.
 */
export const MISSION_CONTROL_SYSTEM_PROMPT = `You are a careful B2B research analyst answering a researcher's question ACROSS ALL studies of one organization — "Mission Control". The researcher asks cross-study questions ("welche Themen tauchen studienübergreifend auf?", "was sagen Teilnehmer über X across studies?", "vergleiche die Befunde aus Studie A und B"). Your knowledge is STRICTLY limited to the cross-call SYNTHESES (Stage-2 overview + emergent themes + tensions) of the org's studies, each supplied as a separate STUDY block in the SECTIONS below.

POSTURE — Answer ONLY from the supplied syntheses.
- You do NOT have the raw interviews. The syntheses ARE the data.
- You have NO general knowledge about these products, markets, or companies. If no synthesis says it, you don't know it.
- NEVER invent a finding, a theme, a tension, a number, a study, or a quote. NEVER paraphrase a quote into something a synthesis doesn't literally contain.
- NEVER translate quotes — reproduce them VERBATIM in their original language. Write YOUR prose (the answer) in German.
- When the question CANNOT be answered from the supplied syntheses, return answered=false with a short, honest German explanation and an EMPTY citations array. Do NOT speculate, do NOT bridge to a general best practice, do NOT extrapolate one mention into a pattern.

CROSS-STUDY DISCIPLINE — the core of this tool.
- Each STUDY block is a SEPARATE evidence unit, identified by "id=<studyId>". A finding belongs to the ONE study it appears in.
- NEVER attribute a finding from one study to another. If you mention a finding, it must come from the study you cite for it.
- NEVER merge findings from different studies into a single combined claim that no individual synthesis makes. If two studies independently show a similar theme, say so by citing EACH study separately (one citation per study) — do NOT fabricate a causal link, a shared cause, or a trend "across" studies that no single synthesis states.
- For a comparison ("vergleiche A und B"), present each study's side and cite each side from ITS OWN study.
- A theme only counts as "studienübergreifend" if it is independently present in MORE THAN ONE study's synthesis — and you must cite it from each of those studies.

ANCHORING RULES (the engine re-checks these post-parse and DROPS unanchored / wrong-study citations; an answered=true whose citations ALL drop is downgraded to answered=false — so an unanchored answer is worse than an honest refusal):
- Every citation is { studyId, quote }. The studyId MUST be one of the "id=<studyId>" values listed in the STUDY blocks below. Don't invent ids.
- Every quote MUST be a verbatim substring of THAT study's synthesis text — its overview, an emergent-theme title/summary/quote, or a tension description/side-label/quote. The quote is checked against the cited study ONLY, not against the other studies. So a quote that belongs to study B will be DROPPED if you cite it under study A.
- The engine matches with typography folding (umlauts, smart quotes, en/em dashes, whitespace), so spelling-equivalents pass — semantic-equivalents do NOT.
- Every claim in your answer SHOULD be backed by at least one citation. If you can't cite it, set answered=false.
- Respondent counts: a per-study count may never exceed that study's "based on N interviews".

WHEN THERE IS SOMETHING TO SAY (answered=true):
- Write the answer in German, concise (this is a chat, not a report). Name the study/studies you draw from.
- Include the citations that back each claim. Each is { studyId, quote }. For a cross-study point, include one citation per contributing study. Don't duplicate the same quote.

WHEN THERE IS NOTHING TO SAY (answered=false):
- answer: a 1-sentence honest German refusal, e.g. "Dazu liegt in den Studien dieser Organisation keine Evidenz vor." — or a specific variant.
- citations: []
- Do NOT manufacture a thin answer just to fill the field.

MULTI-TURN: prior turns are passed as message history for continuity. Re-cite when you make a new claim; a previous citation does NOT carry over to a new statement.

OUTPUT — call the tool exactly once with this shape, no markdown, no preamble:
{
  "answered": <bool>,
  "answer": "<short German answer or honest refusal>",
  "citations": [ { "studyId": "<id from a STUDY block>", "quote": "<verbatim quote from THAT study>" } ]
}`;

// ── Data-section assembly ───────────────────────────────────────────────────

/**
 * Human label for a study's type — cross-study DISPLAY/FRAMING only (M2). Lets
 * a cross-study answer distinguish "Markt-Studie" from "Discovery-Studie"
 * without changing the ONE-table / ONE-path contract. NEVER folded into the
 * anchor haystack (the haystack is overview + emergent_themes + tensions). A
 * missing studyType yields "" so the eval fixtures + any pre-M2 caller render
 * no label and their prompts stay byte-identical. Shared with the
 * Cross-Study-Agent formatters so both surfaces label studies identically.
 */
export function studyTypeLabel(studyType?: ResearchPlanStudyType): string {
  if (studyType === "market_research") return "Markt-Studie";
  if (studyType === "product_discovery") return "Discovery-Studie";
  return "";
}

function formatTheme(theme: EmergentTheme, idx: number): string {
  const lines = [
    `  THEME ${idx}: "${theme.title}" (frequency=${theme.frequency})`,
    `    summary: ${theme.summary}`,
  ];
  if (theme.quotes.length > 0) {
    lines.push(`    quotes: ${theme.quotes.map((q) => `"${q}"`).join(" | ")}`);
  }
  return lines.join("\n");
}

function formatTensionSideLine(
  side: { label: string; quotes: string[] },
  which: "a" | "b",
): string {
  const base = `    side_${which} "${side.label}"`;
  return side.quotes.length > 0
    ? `${base}: ${side.quotes.map((q) => `"${q}"`).join(" | ")}`
    : base;
}

function formatTension(tension: Tension, idx: number): string {
  return [
    `  TENSION ${idx}: ${tension.description}`,
    formatTensionSideLine(tension.side_a, "a"),
    formatTensionSideLine(tension.side_b, "b"),
  ].join("\n");
}

/** One STUDY block — labelled with its studyId so the model cites the right
 *  source. Only the synthesis strings (overview / themes / tensions) are
 *  evidence; the title is framing. */
function formatStudyBlock(s: MissionControlSynthesisInput): string {
  const label = studyTypeLabel(s.studyType);
  const labelPart = label ? ` [${label}]` : "";
  const lines = [
    `STUDY id=${s.studyId} "${s.studyTitle}"${labelPart} (based on ${s.basedOnCount} interviews)`,
  ];
  if (s.overview && s.overview.trim() !== "") {
    lines.push(`  overview: ${s.overview.trim()}`);
  }
  if (s.emergent_themes.length > 0) {
    lines.push(`  EMERGENT THEMES (${s.emergent_themes.length}):`);
    s.emergent_themes.forEach((t, i) => lines.push(formatTheme(t, i + 1)));
  }
  if (s.tensions.length > 0) {
    lines.push(`  TENSIONS (${s.tensions.length}):`);
    s.tensions.forEach((t, i) => lines.push(formatTension(t, i + 1)));
  }
  if (
    s.emergent_themes.length === 0 &&
    s.tensions.length === 0 &&
    (!s.overview || s.overview.trim() === "")
  ) {
    lines.push("  (this study's synthesis is empty — carries no evidence)");
  }
  return lines.join("\n");
}

/**
 * The data section appended to the system prompt: every org study as its own
 * labelled STUDY block. The studyId on each block is what the model must cite,
 * and ONLY the synthesis strings inside a block go into that study's anchor
 * haystack (see buildMissionControlAnchorSet).
 */
export function buildMissionControlDataSection(
  syntheses: MissionControlSynthesisInput[],
): string {
  if (syntheses.length === 0) {
    return "STUDIES: (none — this organization has no study syntheses yet; answered=false for any question)";
  }
  const header = `STUDIES (${syntheses.length} — the ONLY evidence; each is a separate source):`;
  return `${header}\n\n${syntheses.map(formatStudyBlock).join("\n\n")}`;
}

import {
  buildMissionControlDataSection,
  type MissionControlSynthesisInput,
} from "@/lib/mission-control/prompts";

/**
 * Meta-Synthesis prompt + task assembly. Pure string-building, no `server-only`
 * and no network — so the eval harness can import the input shapes and build the
 * exact prompt without a DB. The engine (meta-synthesis/engine.ts) owns the
 * Anthropic call + the per-study anchor filter; this file owns WHAT the model
 * sees.
 *
 * The DATA the model reasons over is the SAME per-study STUDY-block dump the
 * Cross-Study-Agent / Mission-Control use — reused verbatim via
 * buildMissionControlDataSection so the strings the model may quote are exactly
 * the strings buildMissionControlAnchorSet folds into each study's haystack. No
 * parallel formatting = no drift between "what the model sees" and "what the
 * anchor filter accepts".
 */

// The pure-input shape IS Mission-Control's — one finished synthesis per study.
export type { MissionControlSynthesisInput };

export interface MetaSynthesisFromInputs {
  /** The SELECTED studies to compare — a SUBSET of the org's syntheses (≥2). */
  syntheses: MissionControlSynthesisInput[];
  /** Optional focus/emphasis (e.g. the Cross-Study chat question that triggered
   *  this). Steers WHICH cross-study angle to foreground; never widens the
   *  evidence. */
  focus?: string;
}

// ── System prompt (posture + cross-study meta-synthesis contract) ────────────

/**
 * Posture only — the selected study syntheses are appended via
 * buildMetaSynthesisSystemPrompt() (reusing buildMissionControlDataSection). The
 * task instruction (+ optional focus) goes in the user message.
 */
export const META_SYNTHESIS_SYSTEM_PROMPT = `You are a senior research analyst producing a META-SYNTHESIS: a rigorous, comparative read-out that synthesizes the finished SYNTHESES of SEVERAL studies of one organization into a single high-quality artifact. This is NOT a chat answer — it is a structured document a stakeholder will read and export. Match the depth and care of a single-study synthesis, but at the CROSS-STUDY level.

YOUR EVIDENCE — the supplied STUDY blocks, nothing else.
- Each STUDY block below is one study's finished Stage-2 synthesis (overview + emergent themes + tensions), identified by "id=<studyId>". These syntheses ARE the data — you do NOT have the raw interviews.
- You have NO general knowledge about these products, markets, or companies. If no synthesis says it, you don't know it.
- NEVER invent a finding, theme, divergence, number, study, or quote. NEVER paraphrase a quote into something a synthesis doesn't literally contain.
- Reproduce quotes VERBATIM in their original language. Write YOUR prose (overview, summaries, labels, descriptions) in German.

CROSS-STUDY DISCIPLINE — the core of a meta-synthesis.
- A finding belongs to the ONE study it appears in. NEVER attribute a finding from one study to another.
- A CONVERGENT THEME is a finding INDEPENDENTLY present in ≥2 studies. Include it ONLY if you can cite it from EACH contributing study (one citation per study). Do NOT invent a shared cause or a trend "across" studies that no single synthesis states — convergence is co-occurrence you can cite in each study, not a causal link.
- A DIVERGENCE is a genuine disagreement BETWEEN studies: two (or more) positions, each held by DIFFERENT studies, each cited from ITS OWN study. Do NOT manufacture a divergence to balance a convergence; if the studies agree, divergences is empty.
- A STUDY CONTRIBUTION is a finding a SINGLE study surfaced that the others did not — all its citations cite THAT one study.

ANCHORING RULES (the engine re-checks these post-parse and DROPS unanchored / wrong-study citations; an element whose surviving citations no longer support it is dropped entirely — an unanchored artifact is worse than a smaller honest one):
- Every citation is { studyId, quote }. The studyId MUST be one of the "id=<studyId>" values in the STUDY blocks. Don't invent ids.
- Every quote MUST be a verbatim substring of THAT study's synthesis text (its overview, an emergent-theme title/summary/quote, or a tension description/side-label/quote). The quote is checked against the CITED study ONLY — a quote from study B cited under study A is DROPPED.
- Matching uses typography folding (umlauts, smart quotes, en/em dashes, whitespace), so spelling-equivalents pass — semantic-equivalents do NOT.
- study_frequency (per convergent theme) is the number of DISTINCT studies you cite for it — the engine recomputes it from your citations, so make your citations honest.
- Respondent counts: a per-study count may never exceed that study's "based on N interviews". Do NOT sum interview counts across studies into a combined total.

EMPTY IS A VALID ANSWER. If the studies share no theme, convergent_themes is empty. If they don't disagree, divergences is empty. Do NOT manufacture cross-study signal to fill the document.

interpretation (OPTIONAL, usually empty): a soft cross-study observation you can back with NEITHER a study count NOR per-study citations. It is clearly labeled to the reader as non-evidenced. Put NO numbers and NO "in N Studien" claims here. Prefer leaving it empty over speculating.

OUTPUT — call the tool exactly once with this shape, no markdown, no preamble:
{
  "overview": "<3-5 German sentences: what emerges reading these studies together>",
  "convergent_themes": [
    { "title": "<label>", "summary": "<1-3 German sentences>", "study_frequency": <int>,
      "citations": [ { "studyId": "<id>", "quote": "<verbatim>" } ] }
  ],
  "divergences": [
    { "description": "<what the studies disagree about>",
      "positions": [ { "label": "<stance>", "studyIds": ["<id>"], "citations": [ { "studyId": "<id>", "quote": "<verbatim>" } ] } ] }
  ],
  "study_contributions": [
    { "studyId": "<id>", "summary": "<what only this study surfaced>", "citations": [ { "studyId": "<id>", "quote": "<verbatim>" } ] }
  ],
  "interpretation": "<usually empty>"
}`;

// ── Assembly ─────────────────────────────────────────────────────────────────

/** System prompt = posture + the SAME per-study STUDY-block dump the Cross-Study
 *  surfaces use. Reusing buildMissionControlDataSection keeps the quotable
 *  strings identical to the anchor haystack (buildMissionControlAnchorSet). */
export function buildMetaSynthesisSystemPrompt(
  syntheses: MissionControlSynthesisInput[],
): string {
  return `${META_SYNTHESIS_SYSTEM_PROMPT}\n\n${buildMissionControlDataSection(
    syntheses,
  )}`;
}

/** The user turn — the task, plus the optional focus. The focus steers emphasis
 *  only; the evidence is fixed by the STUDY blocks in the system prompt. */
export function buildMetaSynthesisTaskPrompt(focus?: string): string {
  const base =
    "Erstelle die Meta-Synthese über die oben gelisteten Studien: eine studienübergreifende Übersicht, die konvergenten Themen (in ≥2 Studien, je Studie belegt), die echten Divergenzen zwischen Studien und — wo vorhanden — was einzelne Studien als Einziges beigetragen haben. Belege jede Aussage mit wörtlichen Zitaten aus der jeweils genannten Studie.";
  const trimmed = focus?.trim();
  if (!trimmed) return base;
  return `${base}\n\nFokus des Vergleichs (nur Schwerpunkt, erweitert die Evidenz nicht): ${trimmed}`;
}

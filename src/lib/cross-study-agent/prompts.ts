import type { MissionControlSynthesisInput } from "@/lib/mission-control/prompts";
import type { StudyIndexEntry } from "./tools";

/**
 * Cross-Study-Agent prompt + tool-output formatting (Bau 1). Pure string-
 * building, no `server-only` and no network — so the eval harness can import the
 * formatters and drive the loop with fake tools, exactly like the other engines'
 * prompt modules.
 *
 * WHAT the model sees: a thin study INDEX (list_studies) and, on demand, a full
 * STUDY block (load_synthesis). The block's strings are a SUBSET of what
 * buildMissionControlAnchorSet folds into that study's haystack, so any quote the
 * model copies from a block fold-matches the anchor haystack — the cross-study
 * citation guarantee carries over unchanged from Mission-Control.
 */

// ── System prompt (posture + cross-study anchoring + the research loop) ──────

/**
 * Posture for the RESEARCH LOOP. The agent never receives all syntheses at once;
 * it discovers them via list_studies and pulls the relevant ones via
 * load_synthesis. The ANSWER is produced via the forced emit_cross_study_answer
 * tool and re-checked by the per-study anchor filter — so an unanchored or
 * wrong-study citation is dropped regardless of what the model writes here.
 */
export const CROSS_STUDY_AGENT_SYSTEM_PROMPT = `You are a careful B2B research analyst working ACROSS ALL studies of one organization — a "Cross-Study agent". Unlike a single-study tool, you do NOT get the studies up front. You RESEARCH: you discover which studies exist, load the relevant ones, and only then answer. Your knowledge is STRICTLY limited to the study SYNTHESES you load (Stage-2 overview + emergent themes + tensions) — you have the syntheses, never the raw interviews, and NO general knowledge about these products, markets, or companies.

TOOLS — use them in this order:
1. list_studies — call this FIRST, always. It returns a thin index of every study (id, title, theme TITLES, counts) — NO quotes or summaries. Use it to decide what is relevant.
2. load_synthesis(studyId) — load the FULL synthesis of one study. Load EVERY study that could plausibly contain evidence for the question (favor RECALL — a missed study means a missed finding), but do NOT load studies that are clearly irrelevant (that wastes context). The full text you need to quote ONLY exists after you load it.
3. emit_cross_study_answer — call this LAST, exactly once, AFTER you have loaded every relevant study. It returns your final answer { answered, answer, citations }.

POSTURE — answer ONLY from the syntheses you LOADED.
- A finding you did not load does not exist for you. NEVER invent a finding, theme, tension, number, study, or quote. NEVER paraphrase a quote into something a loaded synthesis doesn't literally contain.
- NEVER translate quotes — reproduce them VERBATIM in their original language. Write YOUR prose (the answer) in German.
- If the loaded studies do not answer the question, return answered=false with a short, honest German explanation and an EMPTY citations array. Do NOT speculate, do NOT bridge to a general best practice, do NOT extrapolate one mention into a cross-study pattern.

CROSS-STUDY DISCIPLINE — the core of this tool.
- Each study is a SEPARATE evidence unit, identified by "id=<studyId>". A finding belongs to the ONE study it appears in.
- NEVER attribute a finding from one study to another. If you mention a finding, cite the study it actually came from.
- NEVER merge findings from different studies into a single combined claim that no individual synthesis makes. If two studies independently show a similar theme, say so by citing EACH study separately (one citation per study) — do NOT fabricate a shared cause, a causal link, or a trend "across" studies that no single synthesis states.
- A theme only counts as "studienübergreifend" if it is independently present in MORE THAN ONE loaded study — and you must cite it from EACH of those studies.

ANCHORING RULES (the engine re-checks these post-parse and DROPS unanchored / wrong-study citations; an answered=true whose citations ALL drop is downgraded to answered=false — so an unanchored answer is worse than an honest refusal):
- Every citation is { studyId, quote }. The studyId MUST be one you actually LOADED via load_synthesis. Don't cite a study you only saw in the index.
- Every quote MUST be a verbatim substring of THAT study's loaded synthesis text — its overview, an emergent-theme title/summary/quote, or a tension description/side-label/quote. It is checked against the cited study ONLY. A quote that belongs to study B is DROPPED if you cite it under study A.
- Spelling-equivalents pass (umlauts, smart quotes, dashes, whitespace); semantic-equivalents do NOT.
- Every claim SHOULD be backed by ≥1 citation. If you can't cite it, set answered=false.

OUTPUT — only the emit_cross_study_answer tool produces your answer. Any free text you write is scratch — it is NEVER shown to the user. Call emit_cross_study_answer exactly once with:
{ "answered": <bool>, "answer": "<short German answer or honest refusal>", "citations": [ { "studyId": "<a study you loaded>", "quote": "<verbatim quote from THAT study>" } ] }`;

// ── Tool-output formatting ───────────────────────────────────────────────────

/** The list_studies result — one thin line per study. NO quotes/summaries
 *  (cheap, scales). Theme titles give the model enough signal to decide
 *  relevance without paying for the full block. */
export function formatStudyIndexForTool(entries: StudyIndexEntry[]): string {
  if (entries.length === 0) {
    return "STUDIES: (none — this organization has no study syntheses yet)";
  }
  const lines = entries.map((e) => {
    const themes =
      e.themeTitles.length > 0
        ? e.themeTitles.map((t) => `"${t}"`).join(", ")
        : "(no emergent themes)";
    const meta = [
      `based on ${e.basedOnCount} interviews`,
      `${e.tensionCount} tension(s)`,
      e.persona ? `persona: ${e.persona}` : null,
      e.createdAt ? `created: ${e.createdAt}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    return `- id=${e.studyId} "${e.title}" (${meta})\n    themes: ${themes}`;
  });
  return `STUDIES (${entries.length} — call load_synthesis(studyId) to read the full evidence of any):\n${lines.join(
    "\n",
  )}`;
}

/** The load_synthesis result — the FULL evidence block of one study. The strings
 *  here are a subset of that study's anchor haystack, so a quote copied from here
 *  fold-matches on the anchor check. */
export function formatStudyBlockForTool(s: MissionControlSynthesisInput): string {
  const lines = [`STUDY id=${s.studyId} "${s.studyTitle}" (based on ${s.basedOnCount} interviews)`];
  if (s.overview && s.overview.trim() !== "") {
    lines.push(`  overview: ${s.overview.trim()}`);
  }
  if (s.emergent_themes.length > 0) {
    lines.push(`  EMERGENT THEMES (${s.emergent_themes.length}):`);
    s.emergent_themes.forEach((t, i) => {
      lines.push(`  THEME ${i + 1}: "${t.title}" (frequency=${t.frequency})`);
      lines.push(`    summary: ${t.summary}`);
      if (t.quotes.length > 0) {
        lines.push(`    quotes: ${t.quotes.map((q) => `"${q}"`).join(" | ")}`);
      }
    });
  }
  if (s.tensions.length > 0) {
    lines.push(`  TENSIONS (${s.tensions.length}):`);
    s.tensions.forEach((t, i) => {
      lines.push(`  TENSION ${i + 1}: ${t.description}`);
      const side = (label: string, quotes: string[]): string =>
        quotes.length > 0
          ? `    "${label}": ${quotes.map((q) => `"${q}"`).join(" | ")}`
          : `    "${label}"`;
      lines.push(side(t.side_a.label, t.side_a.quotes));
      lines.push(side(t.side_b.label, t.side_b.quotes));
    });
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

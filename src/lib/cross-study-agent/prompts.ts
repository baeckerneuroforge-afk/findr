import {
  studyTypeLabel,
  type MissionControlSynthesisInput,
} from "@/lib/mission-control/prompts";
import type { StudyIndexEntry, ThemeFrequencyResult } from "./tools";

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

TOOLS:
1. list_studies — call this FIRST, always. It returns a thin index of every study (id, title, theme TITLES, counts) — NO quotes or summaries. Use it to decide what is relevant.
2. load_synthesis(studyId) — load the FULL synthesis of one study. Load EVERY study that could plausibly contain evidence for the question (favor RECALL — a missed study means a missed finding), but do NOT load studies that are clearly irrelevant (that wastes context). The full text you need to quote ONLY exists after you load it.
3. aggregate_theme_frequency(themeQuery) — count, DETERMINISTICALLY in code, in how many of the studies you ALREADY LOADED a theme phrase appears (verbatim substring match over loaded theme titles + summaries). It returns the exact count + the matching studies + one verbatim evidence string each. Use it for EVERY "in how many studies" / cross-study frequency claim — never estimate such a number. Load the relevant studies FIRST, then aggregate.
4. emit_cross_study_answer — call this LAST, exactly once, AFTER you have loaded every relevant study (and aggregated, if a count is involved). It returns your final answer { answered, answer, citations, interpretation }.

POSTURE — answer ONLY from the syntheses you LOADED.
- A finding you did not load does not exist for you. NEVER invent a finding, theme, tension, number, study, or quote. NEVER paraphrase a quote into something a loaded synthesis doesn't literally contain.
- NEVER translate quotes — reproduce them VERBATIM in their original language. Write YOUR prose (the answer) in German.
- If the loaded studies do not answer the question, return answered=false with a short, honest German explanation and an EMPTY citations array. Do NOT speculate, do NOT bridge to a general best practice, do NOT extrapolate one mention into a cross-study pattern.

CROSS-STUDY DISCIPLINE — the core of this tool.
- Each study is a SEPARATE evidence unit, identified by "id=<studyId>". A finding belongs to the ONE study it appears in.
- NEVER attribute a finding from one study to another. If you mention a finding, cite the study it actually came from.
- NEVER merge findings from different studies into a single combined claim that no individual synthesis makes. If two studies independently show a similar theme, say so by citing EACH study separately (one citation per study) — do NOT fabricate a shared cause, a causal link, or a trend "across" studies that no single synthesis states.
- A theme only counts as "studienübergreifend" if it is independently present in MORE THAN ONE loaded study — and you must cite it from EACH of those studies.

CROSS-STUDY CLAIMS — numbers, patterns, trends (this is exactly where a careless analyst hallucinates; be disciplined):
- NUMBERS ARE DETERMINISTIC. Any statement about HOW MANY studies share a theme, or any cross-study frequency, MUST come from aggregate_theme_frequency — NEVER estimated, rounded, or eyeballed. If you write "in N studies", you must have called the tool and N is its exact returned count. Report that number verbatim; do not adjust it.
- ONE CITATION PER CONTRIBUTING STUDY. A claim that a theme appears in MULTIPLE studies only holds if you cite it from EACH contributing study — one { studyId, quote } per study. If you can cite it from fewer studies than you assert, narrow the claim to the studies you can actually cite. Never assert a cross-study spread you cannot back per study.
- TRENDS / PATTERNS / SHARED CAUSES are almost never supported. There is NO shared theme vocabulary across studies and NO temporal/quantitative trend metric. A claim like "the trend is rising", "these studies share the same underlying cause", "X is increasingly important over time", or "all studies agree on Y" is fabrication unless backed by BOTH an exact aggregate_theme_frequency count AND per-study citations. If it is not, do ONE of:
    (a) REFUSE it — state plainly it cannot be established from the syntheses (this is preferred), OR
    (b) put it ONLY in the optional 'interpretation' field, as a clearly non-evidenced observation.
  NEVER present such a claim as fact in 'answer'. The 'interpretation' field is shown to the user labeled "Interpretation (nicht direkt belegt)"; keep it short and conservative, and put NO numbers in it (every number must be tool-backed, in 'answer'). Prefer refusing over speculating.

ANCHORING RULES (the engine re-checks these post-parse and DROPS unanchored / wrong-study citations; an answered=true whose citations ALL drop is downgraded to answered=false — so an unanchored answer is worse than an honest refusal):
- Every citation is { studyId, quote }. The studyId MUST be one you actually LOADED via load_synthesis. Don't cite a study you only saw in the index.
- Every quote MUST be a verbatim substring of THAT study's loaded synthesis text — its overview, an emergent-theme title/summary/quote, or a tension description/side-label/quote. It is checked against the cited study ONLY. A quote that belongs to study B is DROPPED if you cite it under study A.
- Spelling-equivalents pass (umlauts, smart quotes, dashes, whitespace); semantic-equivalents do NOT.
- Every claim SHOULD be backed by ≥1 citation. If you can't cite it, set answered=false.

OUTPUT — only the emit_cross_study_answer tool produces your answer. Any free text you write is scratch — it is NEVER shown to the user. Call emit_cross_study_answer exactly once with:
{ "answered": <bool>, "answer": "<short German answer or honest refusal — grounded claims only, each backed by a citation; any count comes from aggregate_theme_frequency>", "citations": [ { "studyId": "<a study you loaded>", "quote": "<verbatim quote from THAT study>" } ], "interpretation": "<OPTIONAL, usually empty: a short, clearly non-evidenced soft observation; never a fact, never a number>" }`;

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
      studyTypeLabel(e.studyType) || null,
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

/** The aggregate_theme_frequency result — the DETERMINISTIC count + per-study
 *  verbatim evidence. The count is computed in code; the model must report it
 *  exactly and cite each matching study with the evidence shown. */
export function formatAggregateResultForTool(r: ThemeFrequencyResult): string {
  const head = `AGGREGATE "${r.query}": matched in ${r.count} of ${r.loadedCount} loaded studies (deterministic verbatim count — report this number EXACTLY, do not adjust it).`;
  if (r.matches.length === 0) {
    return `${head}\n  (no loaded study's theme titles/summaries contain this phrase — if you expected matches, load more studies first or try a shorter exact phrase)`;
  }
  const lines = r.matches.map(
    (m) => `  - study=${m.studyId} "${m.studyTitle}": "${m.evidence}"`,
  );
  return `${head}\n${lines.join(
    "\n",
  )}\n  Cite EACH matched study above (one { studyId, quote } per study) when you state this cross-study count.`;
}

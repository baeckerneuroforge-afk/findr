import type { EmergentTheme, Tension } from "@/lib/schemas/synthesis";
import type { SynthesisImplication } from "@/lib/schemas/synthesis-advisory";

/**
 * Deterministic guards for the advisory („Beratung") layer. PURE (no server-only,
 * no network) so the eval + a vitest can drive them, and — following the
 * codebase's „deterministisch gatet, Judge berät" principle:
 *   • filterAnchoredImplications GATES: an implication whose `basis` is not an
 *     actual finding (theme title / tension description) is DROPPED — the same
 *     „no invented finding" discipline the quote anchor-filter enforces, applied
 *     to the finding an implication claims to derive from.
 *   • numberFidelityScan WARNS: a hypothesis that introduces a number absent from
 *     the synthesis is flagged (measurement, not a gate — a false positive must
 *     never silently swallow a valid implication).
 * The LLM advisory-grounding judge (evals-synthesis-advisory/judge.ts) advises on
 * framing/traceability and never gates.
 */

/** Typography fold — umlauts, smart quotes, dashes, whitespace, case. */
export function foldAdvisory(s: string): string {
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

export interface AdvisorySource {
  emergent_themes: Pick<EmergentTheme, "title" | "summary" | "quotes">[];
  tensions: Pick<Tension, "description" | "side_a" | "side_b">[];
  overview: string | null;
}

/** The valid `basis` values: folded theme titles + tension descriptions. An
 *  implication's basis must fold-substring-match one of these — that is what
 *  makes it derive from a REAL finding rather than an invented one. */
export function buildFindingRefs(source: AdvisorySource): string[] {
  const refs: string[] = [];
  for (const t of source.emergent_themes) if (t.title) refs.push(foldAdvisory(t.title));
  for (const t of source.tensions) if (t.description) refs.push(foldAdvisory(t.description));
  return refs;
}

/** Everything the synthesis literally says — the number-allowlist haystack. */
export function buildAdvisoryHaystack(source: AdvisorySource): string {
  const parts: string[] = [];
  if (source.overview) parts.push(source.overview);
  for (const t of source.emergent_themes) {
    parts.push(t.title, t.summary, ...(t.quotes ?? []));
  }
  for (const t of source.tensions) {
    parts.push(t.description, t.side_a.label, t.side_b.label);
    parts.push(...(t.side_a.quotes ?? []), ...(t.side_b.quotes ?? []));
  }
  return foldAdvisory(parts.join(" \n "));
}

/** True when an implication's basis names an actual finding. */
function basisIsAnchored(
  implication: SynthesisImplication,
  findingRefs: string[],
): boolean {
  const basis = foldAdvisory(implication.basis);
  // basis matches a finding if the finding-ref contains it OR it contains the
  // finding-ref (tolerates the model copying a slightly longer/shorter span).
  return findingRefs.some((ref) => ref.includes(basis) || basis.includes(ref));
}

/**
 * GATE — split implications into the ones grounded in a real finding (kept) and
 * the ones whose basis names no actual finding (dropped). Prod would persist only
 * `kept`; the eval reports `dropped` as failures.
 */
export function filterAnchoredImplications(
  implications: SynthesisImplication[],
  source: AdvisorySource,
): { kept: SynthesisImplication[]; dropped: SynthesisImplication[] } {
  const findingRefs = buildFindingRefs(source);
  const kept: SynthesisImplication[] = [];
  const dropped: SynthesisImplication[] = [];
  for (const imp of implications) {
    if (basisIsAnchored(imp, findingRefs)) kept.push(imp);
    else dropped.push(imp);
  }
  return { kept, dropped };
}

export interface AdvisoryFinding {
  index: number;
  message: string;
}

const NUMBER_RE = /\d+(?:[.,]\d+)?/g;

/**
 * WARN — flag hypotheses that introduce a number the synthesis doesn't contain.
 * Pure digits only (a „acht von zehn" spelled out is out of scope → the judge).
 * Standalone „1"/„2" are ignored (ordinals/enumerations, not claims).
 */
export function numberFidelityScan(
  implications: SynthesisImplication[],
  source: AdvisorySource,
): AdvisoryFinding[] {
  const haystack = buildAdvisoryHaystack(source);
  const findings: AdvisoryFinding[] = [];
  implications.forEach((imp, index) => {
    const nums = imp.hypothesis.match(NUMBER_RE) ?? [];
    const foreign = nums.filter((n) => {
      if (n === "1" || n === "2") return false; // enumerations, not claims
      return !haystack.includes(foldAdvisory(n));
    });
    if (foreign.length > 0) {
      findings.push({
        index,
        message: `Zahl(en) nicht in der Synthese belegt: ${foreign.join(", ")}`,
      });
    }
  });
  return findings;
}

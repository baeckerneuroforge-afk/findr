import type {
  ResearchPlanStudyType,
  ResearchPlanUseCase,
} from "@/lib/research/db";
import type { StudySynthesisResult } from "@/lib/schemas/synthesis";

/**
 * Synthese Tier-2a — PURE Eval-Check-Helfer (deterministisch, kein LLM, kein
 * `server-only`). Sie MESSEN die Grounding-Lage der Stage-2-Synthese, ohne in
 * den Prod-Pfad einzugreifen:
 *
 *   • numberFidelityScan  (A2) — deterministisch: erfundene Zahlen in der
 *       Freitext-Prosa (overview / theme.summary / tension.description).
 *   • quoteCoverageScan   (A4) — deterministisch: Themen / Tension-Seiten ohne
 *       wörtliches Zitat.
 *   • methodCongruenceRule (A1) — deterministische Regel über die vom LLM-Judge
 *       gelieferten Methoden-Kategorien (Deny-Listen je Studientyp/Use-Case).
 *   • judgeResultToFindings (A1+A3) — reine Abbildung eines (gestubbten oder
 *       echten) Judge-Ergebnisses auf WARN-Befunde.
 *
 * Bewusst frei von `server-only` / engine.ts, damit `vitest run src` das Modul
 * ohne den Supabase-/Anthropic-Rattenschwanz testet (eval-checks.test.ts). Der
 * Eval-Runner (evals-synthesis/run.ts) importiert dieselben Funktionen — eine
 * Quelle der Wahrheit. `fold` ist — wie schon in engine.ts — inline kopiert
 * statt importiert, damit dieses Modul nicht an die Engine koppelt.
 *
 * PRINZIP (Spec §3): DETERMINISTISCHE Checks DÜRFEN architektonisch gaten
 * (severity "fail"); die vom nicht-deterministischen LLM-Judge gespeisten
 * Checks (Grounding A3, Kongruenz A1) sind IMMER "warn" — der Judge gatet
 * nirgends, auch nicht im overview.
 *
 * KALIBRIERUNG (Spec §A2.3): der deterministische A2-Zahlen-Scan WAR der einzige
 * gatende Tier-2a-Check; nach einem Live-Lauf wurde er bewusst überall auf "warn"
 * herabgestuft — er erzeugte False-Positive-FAILs auf legitimer Synthese
 * (Studientitel-Zahlen wie „Q3", korrekt abgeleitete Teil-Counts wie „n=2").
 * numberFidelityScan emittiert daher aktuell NIE "fail"; das "fail"-Literal im
 * CheckSeverity-Typ bleibt erhalten, damit die FAIL-Schärfe zurückkehren kann,
 * sobald die Allowlist erprobt ist. Die ursprünglichen Anti-Halluzinations-Gates
 * im Runner (anchored, frequency-honest, no-fake-tension, methodology-/
 * signal-gate) bleiben davon unberührt und hart.
 */

// ── Typografie-Fold (Kopie aus engine.ts, bewusst dupliziert) ────────────────
//
// Identisch zu engine.ts `fold` — robust gegen Umlaute, typografische Anführungs-
// zeichen und En/Em-Dashes. Auf Ziffern wirkungslos, aber für konsistente
// Tokenisierung gegen den (bereits gefoldeten) Anker-Haystack angewandt.
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

// ── Befund-Typ ───────────────────────────────────────────────────────────────

export type CheckSeverity = "fail" | "warn";

export type SynthesisCheck =
  | "number-fidelity"
  | "quote-coverage"
  | "method-congruence"
  | "grounding";

export interface Finding {
  check: SynthesisCheck;
  severity: CheckSeverity;
  /** Lokator, z.B. "overview", "theme[2].summary", "tension[0].side_a". */
  field: string;
  message: string;
}

function uniq(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

function digits(text: string): string[] {
  return fold(text).match(/\d+/g) ?? [];
}

// ── A2 — Prosa-Zahlentreue (deterministisch, aktuell WARN — s. Kalibrierung) ─

export interface NumberScanContext {
  /** Gefoldeter Haystack ALLER Eingabe-Materialien — in der Praxis
   *  `buildAnchorSet(insights, stimulusExcerpts).foldedHaystack`. Jede dort
   *  vorkommende Ganzzahl gilt als gedeckt. */
  inputHaystack: string;
  /** `based_on_count` = Anzahl der Eingabe-Insights. */
  basedOnCount: number;
  /** Plan-Kontext (Titel + Objective, ROH) — wird mit derselben fold-Logik
   *  zerlegt; jede dort vorkommende Ganzzahl gilt als gedeckt. Deckt legitime
   *  Studientitel-Zahlen ab (z.B. „Q3"), die nicht im Insight-Haystack stehen. */
  planContext?: string;
}

/**
 * Scannt die Freitext-Felder auf Ganzzahlen, die WEDER eine Server-Zahl
 * (`based_on_count`, ein `frequency`, eine `sourceInsightIds`-Mengen-Größe)
 * NOCH im Eingabe-Haystack vorkommen — das ist die „8 von 10"-Fabrikation.
 *
 * Schweregrad (Spec §A2.3, nach Live-Kalibrierung): ÜBERALL "warn" — auch in
 * `overview` und `tension.description`. Ein deterministischer Check, der bei
 * legitimer Synthese (korrekt abgeleitete Teil-Counts wie „n=2") gatet, ist
 * schädlicher als ein WARN; der semantische Fang liegt beim Grounding-Judge
 * (A3). Die FAIL-Schärfe kann zurückkehren, wenn die Allowlist erprobt ist.
 *
 * BEWUSSTE, DOKUMENTIERTE GRENZEN:
 *  - Nur ZIFFERN. Ausgeschriebene Zahlen/Anteile ("acht von zehn", "die
 *    Hälfte") werden NICHT erfasst — diese fängt der LLM-Grounding-Judge (A3).
 *  - Haystack-ZUFALLSTREFFER: kommt eine erfundene Zahl zufällig irgendwo im
 *    Eingabe-Material vor (z.B. als Teil einer anderen Aussage), gilt sie als
 *    gedeckt und wird nicht gemeldet. Das ist der bewusst in Kauf genommene
 *    Preis dafür, legitime Zitat-Zahlen ("20 Euro", Jahreszahlen) nicht
 *    fälschlich zu flaggen. Ein „grünes" Ergebnis heißt also „keine offenkundig
 *    erfundene Ziffer", nicht „jede Zahl bewiesen korrekt".
 */
export function numberFidelityScan(
  result: StudySynthesisResult,
  ctx: NumberScanContext,
): Finding[] {
  const allowed = new Set<string>();
  allowed.add(String(ctx.basedOnCount));
  for (const t of result.emergent_themes) {
    allowed.add(String(t.frequency));
    allowed.add(String(new Set(t.sourceInsightIds).size));
  }
  for (const t of result.tensions) {
    allowed.add(String(new Set(t.side_a.sourceInsightIds).size));
    allowed.add(String(new Set(t.side_b.sourceInsightIds).size));
  }
  for (const n of ctx.inputHaystack.match(/\d+/g) ?? []) allowed.add(n);
  // Plan-Titel + Objective gefoldet: Studientitel-Zahlen (z.B. „Q3") sind
  // legitimer Kontext, stehen aber nicht im Insight-Haystack.
  if (ctx.planContext) {
    for (const n of digits(ctx.planContext)) allowed.add(n);
  }

  const findings: Finding[] = [];
  const scan = (text: string, field: string, severity: CheckSeverity): void => {
    const stray = uniq(digits(text).filter((n) => !allowed.has(n)));
    if (stray.length > 0) {
      findings.push({
        check: "number-fidelity",
        severity,
        field,
        message: `ungedeckte Zahl(en) in der Prosa: ${stray.join(", ")}`,
      });
    }
  };

  // Schweregrad überall "warn" (Kalibrierung, s. Funktions-Doku oben): der
  // deterministische Scan gatet aktuell nicht — vormals "fail" in overview +
  // tension.description, herabgestuft wegen False-Positives auf legitimer Prosa.
  scan(result.overview, "overview", "warn");
  result.emergent_themes.forEach((t, i) =>
    scan(t.summary, `theme[${i}].summary`, "warn"),
  );
  result.tensions.forEach((t, i) =>
    scan(t.description, `tension[${i}].description`, "warn"),
  );
  return findings;
}

// ── A4 — Belegpflicht-Messung (deterministisch, WARN) ────────────────────────

/**
 * Meldet jedes Theme bzw. jede Tension-Seite, die nach dem Anker-Filter KEIN
 * wörtliches Zitat mehr trägt. Reine MESSUNG (Spec A4 Variante c): der Prod-Pfad
 * bleibt unverändert, ein quote-loses Theme überlebt dort weiterhin über gültige
 * IDs. Hart-Entfernen / weiches „ohne Beleg"-Flag sind ausdrücklich Tier 2b.
 */
export function quoteCoverageScan(result: StudySynthesisResult): Finding[] {
  const findings: Finding[] = [];
  result.emergent_themes.forEach((t, i) => {
    if (t.quotes.length === 0) {
      findings.push({
        check: "quote-coverage",
        severity: "warn",
        field: `theme[${i}]`,
        message: `Theme "${t.title}" ohne wörtliches Zitat (nur summary-belegt)`,
      });
    }
  });
  result.tensions.forEach((t, i) => {
    if (t.side_a.quotes.length === 0) {
      findings.push({
        check: "quote-coverage",
        severity: "warn",
        field: `tension[${i}].side_a`,
        message: `Tension-Seite "${t.side_a.label}" ohne wörtliches Zitat`,
      });
    }
    if (t.side_b.quotes.length === 0) {
      findings.push({
        check: "quote-coverage",
        severity: "warn",
        field: `tension[${i}].side_b`,
        message: `Tension-Seite "${t.side_b.label}" ohne wörtliches Zitat`,
      });
    }
  });
  return findings;
}

// ── A1 — Methoden-Kongruenz (deterministische Regel über Judge-Kategorien) ───

/** Vokabular der Methoden-Kategorien, das der LLM-Judge je Theme/Tension
 *  vergeben darf. Single source — der Judge-Schema-`z.enum` baut darauf auf. */
export const SYNTHESIS_CATEGORIES = [
  "price",
  "purchase_intent",
  "pain",
  "segment_need",
  "brand_perception",
  "competitive",
  "message_effect",
  "concept_understanding",
  "feature",
  "other",
] as const;
export type SynthesisCategory = (typeof SYNTHESIS_CATEGORIES)[number];

export interface MethodContext {
  studyType?: ResearchPlanStudyType;
  useCase?: ResearchPlanUseCase | null;
}

/**
 * Deny-Listen je Methode (Spec A1):
 *  - brand_research / creative_test → keine Preis-/Kaufabsichts-/Pain-Kategorie
 *  - concept_test                   → keine Pain-Kategorie
 *  - general_survey                 → KEINE Deny-List (breit; ausdrücklich leer)
 *  - market_research ohne use_case  → KEINE Deny-List (Basis-Persona, breit)
 *  - product_discovery (bzw. undefined → Default product_discovery)
 *                                   → keine Markt-Preis-Lager-Kategorie (price)
 */
function denyListFor(ctx: MethodContext): Set<SynthesisCategory> {
  const { studyType, useCase } = ctx;
  if (useCase === "brand_research" || useCase === "creative_test") {
    return new Set<SynthesisCategory>(["price", "purchase_intent", "pain"]);
  }
  if (useCase === "concept_test") {
    return new Set<SynthesisCategory>(["pain"]);
  }
  if (useCase === "general_survey") {
    return new Set<SynthesisCategory>(); // breit — keine verbotene Kategorie
  }
  if (studyType === "market_research") {
    return new Set<SynthesisCategory>(); // Basis-Markt-Persona, ebenfalls breit
  }
  // product_discovery (oder undefined → Default product_discovery)
  return new Set<SynthesisCategory>(["price"]);
}

/** true = die Kategorie ist für diese Methode zulässig (kongruent). */
export function methodCongruenceRule(
  category: SynthesisCategory,
  ctx: MethodContext,
): boolean {
  return !denyListFor(ctx).has(category);
}

// ── A1 + A3 — Abbildung eines Judge-Ergebnisses auf WARN-Befunde ─────────────

export type GroundingVerdict = "grounded" | "unsupported_claim";

/** Strukturelle Form des LLM-Judge-Ergebnisses (Spec A3): Grounding-Verdikt und
 *  Methoden-Kategorie liegen in GETRENNTEN Feldern, nie verschmolzen. Der
 *  Zod-Schema-Output in evals-synthesis/judge.ts ist auf diese Form festgelegt;
 *  die Unit-Tests stubben sie direkt (kein Live-Call). */
export interface SynthesisJudgeResult {
  overview: { verdict: GroundingVerdict };
  themes: Array<{
    index: number;
    summaryVerdict: GroundingVerdict;
    category: SynthesisCategory;
  }>;
  tensions: Array<{
    index: number;
    descriptionVerdict: GroundingVerdict;
    category: SynthesisCategory;
  }>;
}

/**
 * Reine Abbildung: Judge-Ergebnis → WARN-Befunde. A3 = jedes Feld mit
 * `unsupported_claim` wird zu einem Grounding-WARN; A1 = jede Theme-/Tension-
 * Kategorie, die die Methoden-Regel verletzt, wird zu einem Kongruenz-WARN.
 * NIE "fail" — der Judge gatet nirgends.
 */
export function judgeResultToFindings(
  jr: SynthesisJudgeResult,
  ctx: MethodContext,
): Finding[] {
  const findings: Finding[] = [];

  // A3 — Grounding der Freitext-Felder.
  const verdictFields: Array<[string, GroundingVerdict]> = [
    ["overview", jr.overview.verdict],
    ...jr.themes.map(
      (t): [string, GroundingVerdict] => [
        `theme[${t.index}].summary`,
        t.summaryVerdict,
      ],
    ),
    ...jr.tensions.map(
      (t): [string, GroundingVerdict] => [
        `tension[${t.index}].description`,
        t.descriptionVerdict,
      ],
    ),
  ];
  for (const [field, verdict] of verdictFields) {
    if (verdict === "unsupported_claim") {
      findings.push({
        check: "grounding",
        severity: "warn",
        field,
        message: "LLM-Judge: Aussage nicht durch die Eingaben gedeckt",
      });
    }
  }

  // A1 — Methoden-Kongruenz aus den Kategorien.
  const categoryItems: Array<[string, SynthesisCategory]> = [
    ...jr.themes.map(
      (t): [string, SynthesisCategory] => [`theme[${t.index}]`, t.category],
    ),
    ...jr.tensions.map(
      (t): [string, SynthesisCategory] => [`tension[${t.index}]`, t.category],
    ),
  ];
  for (const [field, category] of categoryItems) {
    if (!methodCongruenceRule(category, ctx)) {
      findings.push({
        check: "method-congruence",
        severity: "warn",
        field,
        message: `Kategorie "${category}" ist für diese Methode untypisch`,
      });
    }
  }

  return findings;
}

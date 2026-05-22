/**
 * Loss-Analysis Eval Dataset
 * ---------------------------
 * 12 hand-crafted test cases for comparing the regex-heuristic loss extractor
 * against a future LLM-based extractor.
 *
 * Design intent (mix is deliberate):
 *  - EASY    : the loss reason is stated with words that match the regex keywords.
 *              Both regex AND LLM should get these right.
 *  - PARAPHRASED: the reason is clearly present but NOT phrased with any regex keyword.
 *              Regex will likely MISS these; the LLM should catch them. This is where
 *              AI earns its keep.
 *  - TRAP    : the text contains a keyword that misleads the regex into the WRONG
 *              category (e.g. "Salesforce" → competitor, when it's actually a wanted
 *              integration). Regex makes an ACTIVE error; the LLM should disambiguate.
 *
 * `primary` = the single correct loss reason (ground truth).
 * `secondary` = other reasons genuinely present (optional, for richer scoring).
 * `lang` / `difficulty` are metadata for slicing eval results later.
 *
 * NOTE: Ground-truth labels were decided pragmatically. The borderline calls
 * (eval_07 budget-vs-timing, eval_05 feature_gap-vs-competitor) were reviewed
 * and locked. Revisit a label only if manual review shows the LABEL is wrong,
 * not just because a model disagrees.
 */

import type { LossReasonType } from "@/lib/loss/extractor";

export interface LossEvalCase {
  id: string;
  lang: "de" | "en";
  difficulty: "easy" | "paraphrased" | "trap";
  transcript: string;
  expected: {
    primary: LossReasonType;
    secondary?: LossReasonType[];
  };
  /** Why this case exists / what it stresses. For human readers, not scoring. */
  rationale: string;
}

export const LOSS_EVAL_CASES: LossEvalCase[] = [
  {
    id: "loss_01",
    lang: "de",
    difficulty: "easy",
    transcript:
      "Am Ende war's uns schlicht zu teuer. Der Preis lag deutlich über dem, was wir eingeplant hatten.",
    expected: { primary: "pricing" },
    rationale: "Direktes Preis-Keyword ('zu teuer'). Regex sollte treffen.",
  },
  {
    id: "loss_02",
    lang: "de",
    difficulty: "paraphrased",
    transcript:
      "Wir sehen den Wert durchaus, aber für das, was es leisten soll, lässt sich die Investition bei uns gerade nicht rechtfertigen. Da müssten wir an anderer Stelle kürzen.",
    expected: { primary: "pricing" },
    rationale:
      "Preis-Einwand ohne ein einziges Regex-Keyword. Regex verfehlt vermutlich, LLM sollte verstehen.",
  },
  {
    id: "loss_03",
    lang: "de",
    difficulty: "easy",
    transcript:
      "Wir haben uns am Ende für Gong entschieden. Die waren für unseren Use Case einfach weiter.",
    expected: { primary: "competitor" },
    rationale: "Markenname 'Gong' + 'entschieden für'. Regex sollte treffen.",
  },
  {
    id: "loss_04",
    lang: "en",
    difficulty: "paraphrased",
    transcript:
      "We went a different direction in the end — another vendor already had internal traction and the team felt more comfortable moving forward with them.",
    expected: { primary: "competitor" },
    rationale:
      "Wettbewerbs-Verlust ohne Markennamen und ohne 'going with X'. Regex verfehlt vermutlich.",
  },
  {
    id: "loss_05",
    lang: "de",
    difficulty: "trap",
    transcript:
      "Wir nutzen Salesforce sehr intensiv, und die native Anbindung daran ist für uns Pflicht. Genau die fehlt euch leider.",
    expected: { primary: "feature_gap", secondary: ["competitor"] },
    rationale:
      "FALLE: 'Salesforce' triggert Regex fälschlich auf competitor, obwohl es eine gewünschte Integration ist. Wahrer Grund: fehlende Integration = feature_gap.",
  },
  {
    id: "loss_06",
    lang: "de",
    difficulty: "easy",
    transcript:
      "Der CFO hat die Budgetfreigabe am Ende verweigert. Dieses Jahr läuft da nichts mehr.",
    expected: { primary: "budget" },
    rationale: "'CFO' + 'Budgetfreigabe verweigert'. Regex sollte treffen.",
  },
  {
    id: "loss_07",
    lang: "de",
    difficulty: "paraphrased",
    transcript:
      "Grundsätzlich passt das für uns — aber die Mittel sind erst im nächsten Geschäftsjahr da. Vorher können wir das nicht stemmen.",
    expected: { primary: "budget", secondary: ["timing"] },
    rationale:
      "Grenzfall budget-vs-timing: gelockt als budget (das Geld ist das Hindernis), timing sekundär. 'Mittel erst nächstes Geschäftsjahr' ist kein klares Regex-Keyword.",
  },
  {
    id: "loss_08",
    lang: "de",
    difficulty: "easy",
    transcript:
      "Meine Ansprechpartnerin Frau Berg hat das Unternehmen verlassen. Ihr Nachfolger will das Projekt erstmal komplett neu bewerten.",
    expected: { primary: "champion_lost", secondary: ["no_decision"] },
    rationale: "'verlassen' + 'Nachfolger'. Regex sollte champion_lost treffen.",
  },
  {
    id: "loss_09",
    lang: "de",
    difficulty: "easy",
    transcript:
      "Aktuell ist einfach nicht der richtige Zeitpunkt für uns. Lasst uns nächstes Quartal nochmal sprechen.",
    expected: { primary: "timing" },
    rationale: "'nicht der richtige Zeitpunkt' + 'nächstes Quartal'. Regex sollte treffen.",
  },
  {
    id: "loss_10",
    lang: "de",
    difficulty: "easy",
    transcript:
      "Unser Betriebsrat und die Rechtsabteilung haben Bedenken wegen der DSGVO. Ohne deren Freigabe geht bei uns gar nichts.",
    expected: { primary: "compliance" },
    rationale: "'Betriebsrat', 'Rechtsabteilung', 'DSGVO'. Regex sollte treffen.",
  },
  {
    id: "loss_11",
    lang: "en",
    difficulty: "paraphrased",
    transcript:
      "Honestly we just never got around to making a call on it — it kept slipping down the list and then the quarter ended.",
    expected: { primary: "no_decision" },
    rationale:
      "Verschleppung statt klarer 'no decision yet'-Formulierung. Regex verfehlt vermutlich, LLM sollte den Nicht-Entscheidungs-Charakter erkennen.",
  },
  {
    id: "loss_12",
    lang: "de",
    difficulty: "easy",
    transcript:
      "Bei uns läuft gerade eine große Umstrukturierung. Der Fokus liegt komplett woanders, das Thema ist bei uns erstmal vom Tisch.",
    expected: { primary: "internal_priority" },
    rationale: "'Umstrukturierung' + 'Fokus liegt woanders'. Regex sollte treffen.",
  },
];

/**
 * Quick reference — distribution of this dataset:
 *   By reason:  pricing ×2, competitor ×2, budget ×2, feature_gap ×1,
 *               champion_lost ×1, timing ×1, compliance ×1, no_decision ×1,
 *               internal_priority ×1   (other intentionally omitted — it's a fallback)
 *   By difficulty: easy ×7, paraphrased ×4, trap ×1
 *   By language:   de ×9, en ×3
 *
 * Expected story when both extractors run:
 *   - regex should score well on the 7 EASY cases, poorly on the 4 PARAPHRASED,
 *     and WRONG on the 1 TRAP.
 *   - an LLM should match regex on EASY and pull clearly ahead on PARAPHRASED + TRAP.
 *   If the LLM does NOT pull ahead, that's a real finding: AI may not be worth the
 *   cost here yet. The gap on paraphrased/trap cases is the whole point of measuring.
 */

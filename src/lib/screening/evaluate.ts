import type {
  ScreeningAnswers,
  ScreeningAnswerValue,
  ScreeningQuestion,
  ScreeningQuestions,
} from "../schemas/screening";

/**
 * Deterministische, KI-freie Screening-Auswertung. Pure + DB-frei (Vorbild
 * accounts/value.ts, health/aggregate.ts): rein aus (Fragen, Antworten) ->
 * Ergebnis, keine Seiteneffekte, isomorph server/client einsetzbar.
 *
 * Semantik (Entscheidung André):
 *  - Striktes UND NUR über die required-Fragen: qualifiziert, wenn JEDE
 *    Pflichtfrage passt.
 *  - Fehlende Pflichtantwort = nicht qualifiziert (fail-closed).
 *  - Optionale Fragen blocken nie (ihr Treffer wird in perQuestion berichtet,
 *    fließt aber nicht in `qualified`).
 *  - Leere Config = qualifiziert (No-op): [].every(...) === true.
 */
export interface ScreeningResult {
  qualified: boolean;
  /** Pro Frage-id: erfüllt die Antwort die Annahme-Kriterien dieser Frage? */
  perQuestion: Record<string, boolean>;
}

function matchesQuestion(
  question: ScreeningQuestion,
  answer: ScreeningAnswerValue | undefined,
): boolean {
  // Unbeantwortet: Pflichtfrage scheitert (fail-closed), optionale Frage passt.
  if (answer === undefined || answer === null) {
    return !question.required;
  }

  switch (question.type) {
    case "single_choice":
      return typeof answer === "string" && question.accepted.includes(answer);
    case "multi_choice":
      return (
        Array.isArray(answer) &&
        answer.some((choice) => question.acceptedAny.includes(choice))
      );
    case "number_range":
      return (
        typeof answer === "number" &&
        Number.isFinite(answer) &&
        answer >= question.min &&
        answer <= question.max
      );
    default:
      // Erschöpft die Union — ein neuer Frage-Typ erzwingt hier einen
      // Compile-Fehler, statt still durchzurutschen.
      return ((_exhaustive: never): boolean => false)(question);
  }
}

export function evaluateScreening(
  questions: ScreeningQuestions,
  answers: ScreeningAnswers,
): ScreeningResult {
  const perQuestion: Record<string, boolean> = {};
  for (const question of questions) {
    perQuestion[question.id] = matchesQuestion(question, answers[question.id]);
  }

  // Striktes UND über die Pflichtfragen. Leere Config -> every() über [] = true.
  const qualified = questions
    .filter((question) => question.required)
    .every((question) => perQuestion[question.id]);

  return { qualified, perQuestion };
}

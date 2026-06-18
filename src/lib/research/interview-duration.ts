/**
 * Eine Wahrheit für die geschätzte Interviewdauer.
 *
 * Vor diesem Modul existierten mehrere voneinander entkoppelte „Dauer"-Zahlen
 * (freie LLM-Schätzung, Topic-Arithmetik, fest verdrahtete E-Mail-Minuten), die
 * einander widersprachen und das vom Forscher gesetzte Zeitlimit ignorierten.
 * `estimateInterviewMinutes` ist die zentrale, deterministische Funktion, die
 * Vorschau, Längen-Eingabe und Einladungs-E-Mail gemeinsam nutzen.
 *
 * BEWUSST OHNE `server-only`: Das Modul wird sowohl im Client (Erstellungs-Form)
 * als auch im Server (E-Mail-Orchestrierung) importiert. Es darf daher NICHTS
 * server-only Importieren.
 */

/**
 * Fragen-Obergrenze (Agent-Fragen) für eine Research-Studie ohne explizites
 * `maxRounds`. EINZIGE Quelle der Wahrheit: `interviewer.ts` leitet sein
 * `DEFAULT_RESEARCH_AGENT_CEILING` aus dieser Konstante ab, damit Schätzung und
 * echte Engine-Decke nie auseinanderlaufen.
 */
export const DEFAULT_RESEARCH_QUESTION_CEILING = 6;

/**
 * Grobe Ø-Dauer je Agent-Frage (inkl. Teilnehmer-Antwort + 2–4 Probes), in
 * Minuten. Bewusste, zentral tunbare Heuristik: Akkurat ist die Schätzung vor
 * allem dann, wenn ein Zeitlimit gesetzt ist — dann gewinnt das Cap (siehe
 * `estimateInterviewMinutes`). Ohne Limit ist dies eine ehrliche Näherung.
 */
export const MINUTES_PER_QUESTION = 1.5;

/**
 * Effektive Fragen-Obergrenze, die das Interview tatsächlich anstrebt:
 * der konfigurierte `maxRounds`-Wert, sonst der System-Default.
 */
export function effectiveQuestionCeiling(maxRounds?: number | null): number {
  return maxRounds ?? DEFAULT_RESEARCH_QUESTION_CEILING;
}

/**
 * Geschätzte Gesamtdauer eines Interviews in (ganzen) Minuten.
 *
 * Vorrang-Regel: Ist ein Zeitlimit (`maxDurationSeconds`) gesetzt, IST das die
 * Dauer — es ist das real durchgesetzte Cap (Voice hart, Text weich) und damit
 * die ehrlichste Zahl. Ohne Zeitlimit wird aus der Fragen-Obergrenze
 * geschätzt. Untergrenze 1 Minute, damit nie „0 Min" angezeigt wird.
 */
export function estimateInterviewMinutes(cfg: {
  maxRounds?: number | null;
  maxDurationSeconds?: number | null;
}): number {
  if (cfg.maxDurationSeconds != null) {
    return Math.max(1, Math.round(cfg.maxDurationSeconds / 60));
  }
  const questions = effectiveQuestionCeiling(cfg.maxRounds);
  return Math.max(1, Math.round(questions * MINUTES_PER_QUESTION));
}

/**
 * True, wenn die angezeigte Dauer aus einem explizit gesetzten Zeitlimit stammt
 * (= hartes Cap) statt aus der Fragen-Heuristik. Nützlich für die UI/E-Mail-
 * Formulierung („bis zu X Min" vs. „ca. X Min").
 */
export function isDurationFromTimeCap(cfg: {
  maxDurationSeconds?: number | null;
}): boolean {
  return cfg.maxDurationSeconds != null;
}

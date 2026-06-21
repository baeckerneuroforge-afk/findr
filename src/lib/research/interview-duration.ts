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

// ────────────────────────────────────────────────────────────────────────────
// Interview-TIEFE — der eigentliche Tiefe-Hebel (Laddering-Schichten pro Thema).
//
// Die alte reine Fragen-Obergrenze (`maxRounds`) kollabierte als Tiefe-Regler:
// eine fest verdrahtete Pro-Thema-Sättigung („max. 1 Nachfrage, nie 3.")
// deckelte jedes Thema bei ~2 Fragen, sodass die Gesamtdecke (6/10) nie griff —
// „Standard" und „Tief" lieferten praktisch dasselbe Interview. Die TIEFE
// steuert stattdessen, wie viele Nachhak-Schichten der Agent PRO THEMA geht,
// bevor ein Thema als erschöpft gilt; die Gesamtlänge ergibt sich daraus
// (Schichten × Themen). Bleibt adaptiv: tiefere Schichten werden nur gestellt,
// wenn Substanz da ist — ein Absenz-Signal schließt jederzeit früher.
// ────────────────────────────────────────────────────────────────────────────

export type InterviewDepth = "flach" | "mittel" | "tief";

/** System-Default: 2 Schichten/Thema = das bisherige Pro-Thema-Verhalten. */
export const DEFAULT_INTERVIEW_DEPTH: InterviewDepth = "mittel";

/** Laddering-Schichten pro Thema je Tiefe (André, 2026-06-21): flach = nur die
 *  Einstiegsfrage, mittel = + eine Vertiefung (≈ Status quo), tief = bis zu vier
 *  Schichten Richtung konkrete Story / Bedeutung. */
export const DEPTH_LAYERS: Record<InterviewDepth, number> = {
  flach: 1,
  mittel: 2,
  tief: 4,
};

/** Hartes Gesamt-Limit an Agent-Fragen, unabhängig von Tiefe×Themen — schützt
 *  Kosten/Zeit bei sehr vielen Themen. Deckt sich mit der Experten-Obergrenze
 *  des Formulars (2..15). */
export const ABSOLUTE_QUESTION_CAP = 15;

/** Puffer über der erwarteten Fragenzahl bis zur harten Sicherheitsnetz-Decke. */
const CEILING_BUFFER = 2;

/** Schichten pro Thema für eine (ggf. fehlende) Tiefe. */
export function depthLayers(depth?: InterviewDepth | null): number {
  return DEPTH_LAYERS[depth ?? DEFAULT_INTERVIEW_DEPTH];
}

/**
 * Erwartete (typische) Agent-Fragenzahl einer Studie: Schichten × Themen
 * (mind. 1 Thema). Die ehrliche „≈ X Fragen"-Zahl für Vorschau, Dauer-Schätzung
 * und Fortschrittsbalken-Nenner — KEINE Obergrenze (die Sättigung schließt evtl.
 * früher).
 */
export function expectedQuestionCount(
  depth: InterviewDepth | null | undefined,
  topicCount: number,
): number {
  const topics = Math.max(1, Math.floor(topicCount) || 1);
  return depthLayers(depth) * topics;
}

/**
 * Harte Sicherheitsnetz-Decke (Agent-Fragen) — sitzt ÜBER der erwarteten Zahl,
 * damit der Agent normalerweise zuerst per Sättigung (done:true) schließt; nur
 * bei Drift greift sie. Für Kosten hart gedeckelt (ABSOLUTE_QUESTION_CAP).
 */
export function depthQuestionCeiling(
  depth: InterviewDepth | null | undefined,
  topicCount: number,
): number {
  return Math.min(
    expectedQuestionCount(depth, topicCount) + CEILING_BUFFER,
    ABSOLUTE_QUESTION_CAP,
  );
}

/**
 * Effektive Fragen-Obergrenze, die das Interview tatsächlich anstrebt:
 * der konfigurierte `maxRounds`-Wert, sonst der System-Default.
 */
export function effectiveQuestionCeiling(maxRounds?: number | null): number {
  return maxRounds ?? DEFAULT_RESEARCH_QUESTION_CEILING;
}

/**
 * Die effektive Agent-Fragen-Obergrenze, die als `maxRounds` in den
 * Agent-Snapshot wandert und die die gesamte bestehende Pipeline (Prompt-Stop
 * `formatRoundCeiling`, `researchTotalCap`, Fortschritt, Dauer) speist:
 *
 *   1. Ein EXPLIZITER Experten-`maxRounds` gewinnt immer (Rückwärtskompatibilität
 *      + Power-User über das „Erweitert"-Feld).
 *   2. Sonst, wenn eine TIEFE gesetzt ist: themenbewusst aus Tiefe × Themen.
 *   3. Sonst (Bestandsstudie ohne Tiefe UND ohne maxRounds): der flache
 *      System-Default — exakt das heutige Verhalten, byte-identisch.
 *
 * So bekommt die alte Zahlen-Pipeline nur eine bessere Zahl, ohne dass eine
 * ihrer Stellen geändert werden muss.
 */
export function resolveEffectiveMaxRounds(cfg: {
  maxRounds?: number | null;
  depth?: InterviewDepth | null;
  topicCount: number;
}): number {
  if (cfg.maxRounds != null) return cfg.maxRounds;
  if (cfg.depth != null) return depthQuestionCeiling(cfg.depth, cfg.topicCount);
  return DEFAULT_RESEARCH_QUESTION_CEILING;
}

/**
 * Die erwartete (typische) Fragenzahl für Anzeige/Schätzung — anders als
 * resolveEffectiveMaxRounds (die Sicherheitsnetz-DECKE) ist dies die ehrliche
 * „≈ X Fragen"-Zahl: expliziter Experten-maxRounds gewinnt, sonst Tiefe×Themen,
 * sonst der flache Legacy-Default. Eine Wahrheit für Form-Vorschau,
 * Dauer-Schätzung und den Fortschrittsbalken-Nenner.
 */
export function resolveExpectedQuestions(cfg: {
  maxRounds?: number | null;
  depth?: InterviewDepth | null;
  topicCount?: number;
}): number {
  if (cfg.maxRounds != null) return cfg.maxRounds;
  if (cfg.depth != null)
    return expectedQuestionCount(cfg.depth, cfg.topicCount ?? 1);
  return DEFAULT_RESEARCH_QUESTION_CEILING;
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
  depth?: InterviewDepth | null;
  topicCount?: number;
  maxDurationSeconds?: number | null;
}): number {
  if (cfg.maxDurationSeconds != null) {
    return Math.max(1, Math.round(cfg.maxDurationSeconds / 60));
  }
  // Honest typical length (resolveExpectedQuestions): explicit expert maxRounds
  // wins; else depth × topics; else the legacy flat default (byte-identical for
  // pre-depth callers).
  const questions = resolveExpectedQuestions(cfg);
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

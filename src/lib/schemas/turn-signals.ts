import { z } from "zod";

/**
 * Turn-Signale — Schema (E1, Plan ../findr-turn-signals/docs/
 * findr-turn-signals-plan.md §4.1/§4.2).
 *
 * Zwei Formen, bewusst getrennt:
 *
 *   1. TurnSignalsExtractionSchema — was das MODELL liefert (forced tool-use
 *      via callClaudeStructured). Enthält NUR, was das Modell beurteilen kann:
 *      pro Antwort-Turn Affekt + Direktheit + wörtliches Beleg-Zitat, plus den
 *      Session-Affektbogen. Die Zählwerte (evasiveCount/directCount) liefert
 *      das Modell NICHT — sie werden deterministisch aus den Turns abgeleitet
 *      (sealTurnSignals in research/turn-signals.ts): ein Halluzinations-
 *      vektor weniger, nie inkonsistent zu den Turns.
 *
 *   2. TurnSignalsRecord — die persistierte, versionierte Form in
 *      interview_sessions.turn_signals (jsonb): Extraktion + Server-Metadaten
 *      (version/analyzedAt/model) + abgeleitete Counts, nach der
 *      Evidence-/Index-Validierung.
 *
 * TAXONOMIE-LEITPLANKEN (Rechtsanker, nicht Stilfrage):
 *   - Die Affekt-Taxonomie ist GESCHLOSSEN (6 Zustände + neutral ist einer
 *     davon) und enthält bewusst KEINE Gesundheitszustände (kein „gestresst/
 *     ängstlich/depressiv"), KEINE Persönlichkeitsurteile und KEINE
 *     Täuschungs-/Ehrlichkeitsurteile — Labels sind nach DSGVO Art. 15
 *     auskunftspflichtig und dürfen keine Art.-9-Kategorien offenbaren.
 *     Erweiterungen NUR über eine neue Version + erneute Rechtsprüfung.
 *   - `declined` ist ein LEGITIMES Label („will ich nicht sagen" ist bei
 *     Preisfragen selbst ein Befund), kein Qualitätsurteil über die Person.
 *   - Jedes nicht-neutrale Affekt-Label braucht ein wörtliches Beleg-Zitat
 *     (Anti-Halluzination, Evidence-Kultur wie product_discovery_insights);
 *     die Substring-Härtung passiert server-seitig in sealTurnSignals.
 */

// ── Geschlossene Vokabulare (§4.2) ──────────────────────────────────────────

export const AFFECT_STATES = [
  "enthusiasm",
  "interest",
  "neutral",
  "uncertainty",
  "frustration",
  "discomfort",
] as const;
export type AffectState = (typeof AFFECT_STATES)[number];

export const AFFECT_INTENSITIES = ["low", "medium", "high"] as const;
export type AffectIntensity = (typeof AFFECT_INTENSITIES)[number];

export const DIRECTNESS_LEVELS = [
  "direct",
  "partial",
  "evasive",
  "declined",
] as const;
export type DirectnessLevel = (typeof DIRECTNESS_LEVELS)[number];

// ── 1. Modell-Output (Tool-Input-Schema) ────────────────────────────────────

export const TurnSignalSchema = z.object({
  index: z
    .number()
    .int()
    .min(0)
    .describe(
      "The bracketed turn number of the PARTICIPANT turn this signal describes, exactly as printed in the transcript.",
    ),
  affect: z
    .enum(AFFECT_STATES)
    .describe(
      "Conversational affect READ FROM THE WORDING of this answer. 'neutral' is the correct default whenever the wording carries no clear affect.",
    ),
  affectIntensity: z.enum(AFFECT_INTENSITIES),
  affectEvidence: z
    .string()
    .nullable()
    .describe(
      "VERBATIM contiguous quote from THIS participant turn that carries the affect. REQUIRED for every non-neutral affect; null only for 'neutral'. Never paraphrase, never stitch fragments.",
    ),
  directness: z
    .enum(DIRECTNESS_LEVELS)
    .describe(
      "Did this answer actually address the interviewer's preceding question? direct = answered; partial = a real aspect left unaddressed; evasive = changed topic / pure generality; declined = explicitly did not want to answer (a legitimate answer, not a failure).",
    ),
  unansweredAspect: z
    .string()
    .nullable()
    .describe(
      "Only when directness is NOT 'direct': the concrete aspect of the question that remained unanswered, in the transcript's language. Null for 'direct'.",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Calibrated confidence in THIS turn's labels. Irony, politeness formulas and very short answers warrant low values.",
    ),
});
export type TurnSignal = z.infer<typeof TurnSignalSchema>;

export const TurnSignalsExtractionSchema = z.object({
  turns: z
    .array(TurnSignalSchema)
    .describe(
      "One entry PER PARTICIPANT TURN, in transcript order. Interviewer turns are never labeled.",
    ),
  session: z.object({
    affectArc: z
      .string()
      .describe(
        "2–3 sentences, in the transcript's language: how the participant's engagement moved across the conversation (e.g. started reserved, warmed up on topic X, hesitated on pricing). Grounded in the turns — no speculation about inner states.",
      ),
  }),
});
export type TurnSignalsExtraction = z.infer<typeof TurnSignalsExtractionSchema>;

// ── 2. Persistierte Form (interview_sessions.turn_signals) ──────────────────

export const TURN_SIGNALS_VERSION = 1;

export interface TurnSignalsRecord {
  version: typeof TURN_SIGNALS_VERSION;
  /** Server-Zeitstempel der Analyse (ISO). */
  analyzedAt: string;
  /** Tatsächlich verwendetes Modell (Nachvollziehbarkeit/Eval-Vergleiche). */
  model: string;
  /** Validierte Signale — nur Einträge, deren index auf einen echten
   *  customer-Turn zeigt; Evidence substring-gehärtet (sealTurnSignals). */
  turns: TurnSignal[];
  session: {
    affectArc: string;
    /** Deterministisch: turns mit directness === "evasive". */
    evasiveCount: number;
    /** Deterministisch: turns mit directness === "direct". */
    directCount: number;
  };
}

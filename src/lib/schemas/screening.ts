import { z } from "zod";

/**
 * Screening — Zod-Schemas für den inbound Qualifizierungs-Fragebogen (Phase 4).
 *
 * Zwei Verträge:
 *  1. ScreeningQuestion[] — die Researcher-Konfiguration, die als WEICHES jsonb
 *     auf research_plans.screening_questions liegt (Validierung im TS-Layer,
 *     nicht in der DB — wie topic_script).
 *  2. ScreeningAnswers — die vom Teilnehmer eingereichten Antworten.
 *
 * Die Auswertung (qualifiziert?) ist deterministisch und lebt in
 * ../screening/evaluate.ts — KEINE KI.
 *
 * Drei Frage-Typen in v1:
 *  - single_choice: eine Auswahl aus options[]; passt, wenn die Antwort in
 *    accepted[] liegt.
 *  - multi_choice: mehrere Auswahlen aus options[]; passt, wenn mind. eine
 *    gewählte Antwort in acceptedAny[] liegt.
 *  - number_range: eine Zahl; passt, wenn min <= Antwort <= max (inklusiv).
 *
 * Konvention wie schemas/risk.ts, schemas/synthesis.ts (Zod + z.infer-Typen).
 */

const QuestionId = z.string().min(1).max(100);
const Prompt = z.string().min(1).max(500);
const Choice = z.string().min(1).max(200);

export const SingleChoiceQuestionSchema = z.object({
  id: QuestionId,
  type: z.literal("single_choice"),
  prompt: Prompt,
  // Default true: Fragen sind standardmäßig Pflicht (Entscheidung André).
  required: z.boolean().default(true),
  options: z.array(Choice).min(1).max(20),
  accepted: z.array(Choice).min(1).max(20),
});

export const MultiChoiceQuestionSchema = z.object({
  id: QuestionId,
  type: z.literal("multi_choice"),
  prompt: Prompt,
  required: z.boolean().default(true),
  options: z.array(Choice).min(1).max(20),
  acceptedAny: z.array(Choice).min(1).max(20),
});

export const NumberRangeQuestionSchema = z.object({
  id: QuestionId,
  type: z.literal("number_range"),
  prompt: Prompt,
  required: z.boolean().default(true),
  min: z.number(),
  max: z.number(),
});

export const ScreeningQuestionSchema = z.discriminatedUnion("type", [
  SingleChoiceQuestionSchema,
  MultiChoiceQuestionSchema,
  NumberRangeQuestionSchema,
]);

export const ScreeningQuestionsSchema = z
  .array(ScreeningQuestionSchema)
  .max(30)
  // Eindeutige ids — die eingereichten Antworten werden per id zugeordnet.
  .refine((qs) => new Set(qs.map((q) => q.id)).size === qs.length, {
    message: "screening_questions: ids must be unique",
  })
  // number_range muss ein gültiges Intervall sein.
  .refine(
    (qs) => qs.every((q) => q.type !== "number_range" || q.min <= q.max),
    { message: "screening_questions: number_range min must be <= max" },
  );

/**
 * Eine eingereichte Antwort, je nach Frage-Typ:
 *  - single_choice -> string  (gewählte Option)
 *  - multi_choice  -> string[] (gewählte Optionen)
 *  - number_range  -> number
 */
export const ScreeningAnswerValueSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.number(),
]);

/**
 * Zuordnung Frage-id -> Antwort. Fehlende Schlüssel sind erlaubt (unbeantwortet);
 * die Auswertung behandelt fehlende Pflichtantworten fail-closed.
 */
export const ScreeningAnswersSchema = z.record(
  z.string(),
  ScreeningAnswerValueSchema,
);

export type SingleChoiceQuestion = z.infer<typeof SingleChoiceQuestionSchema>;
export type MultiChoiceQuestion = z.infer<typeof MultiChoiceQuestionSchema>;
export type NumberRangeQuestion = z.infer<typeof NumberRangeQuestionSchema>;
export type ScreeningQuestion = z.infer<typeof ScreeningQuestionSchema>;
export type ScreeningQuestions = z.infer<typeof ScreeningQuestionsSchema>;
export type ScreeningAnswerValue = z.infer<typeof ScreeningAnswerValueSchema>;
export type ScreeningAnswers = z.infer<typeof ScreeningAnswersSchema>;

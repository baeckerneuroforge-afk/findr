import { z } from "zod";

import {
  MissionControlCitationSchema,
  MissionControlHistoryTurnSchema,
} from "./mission-control";

/**
 * Konsoul-Agent schema (P2 — der read-only Orchestrator, 'ein Gehirn, mehrere
 * Türen").
 *
 * Konsoul beantwortet drei Klassen von Fragen über EINEN vereinheitlichten
 * Response-Envelope mit einem `kind`-Diskriminator:
 *
 *   - THEME-Fragen → an den UNVERÄNDERTEN Cross-Study-Agenten DELEGIERT. Dessen
 *     Result (`{ answered, answer, citations, interpretation }`) wird verbatim
 *     durchgereicht; die Engine LEITET `kind` daraus ab (`grounded` /
 *     `interpretation` / `refusal`), ohne den Cross-Study-Typ anzufassen. Damit
 *     bleibt jede Theme-Antwort byte-gleich zu heute.
 *   - BREITE Portfolio-/Status-Fragen + HILFE/How-to → `kind:'guidance'`. Eine
 *     NEUTRALE Karte: 'beantwortet, NICHT belegt". Nie das grüne Belegt-Gesicht,
 *     nie Zitate. Harte Zahlen reisen strukturiert in `data` (PortfolioFacts),
 *     deterministisch von Read-Tools berechnet — das Modell schreibt nur Prosa.
 *
 * Der `kind`-Diskriminator ist NEU und lebt NUR hier im Konsoul-Envelope
 * (KonsoulResult) — der Cross-Study-Result trägt KEIN `kind` (verifiziert
 * schemas/cross-study-agent.ts). Das Frontend rendert ausschließlich nach
 * `kind`; grün ist konstruktiv nur über den `grounded`-Zweig (echte, anker-
 * überlebte Zitate aus dem delegierten Opus-Cross-Study) erreichbar.
 *
 * Ehrlichkeitsvertrag (Plan §6, nicht verhandelbar): jede Zahl in `data` stammt
 * aus einem deterministischen org-Aggregat-Read; das Modell darf in `answer` nur
 * Zahlen nennen, die wörtlich in `data` stehen, und nie selbst schätzen/runden/
 * aggregieren. `completedSessions:null` (Lesefehler) rendert das Frontend als
 * '—", nie als 0.
 */

// ── Request (Klon von Cross-Study — orgId/question/history) ───────────────────

export const KonsoulAgentRequestSchema = z.object({
  /** Org, deren Portfolio/Studien der Agent lesen darf (org-scoped, server-only).
   *  Die Route entfernt das Feld per `.omit({orgId:true})` aus dem Body und setzt
   *  es ausschließlich aus requireOrgIdOrError() — NIE aus dem Client. */
  orgId: z.string().min(1).max(200),
  question: z.string().min(1).max(2000),
  /** Vorige Gesprächszüge (multi-turn). Als Kontext in die Orchestrator-Messages
   *  gefädelt; bei Delegation 1:1 an den Cross-Study-Agenten weitergereicht.
   *  Selber HistoryTurn-Typ wie Cross-Study (MissionControlHistoryTurn). */
  history: z.array(MissionControlHistoryTurnSchema).max(20).optional(),
});
export type KonsoulAgentRequest = z.infer<typeof KonsoulAgentRequestSchema>;

// ── PortfolioFacts (deterministischer Datenblock für guidance.data) ───────────

/** Ein konkreter Konsoul-Signal-Eintrag (deterministisch aus computeKonsoulSignals).
 *  Reist als reine Zahl + Schlüssel — nie als Modell-Prosa. */
export const KonsoulFactSignalSchema = z.object({
  kind: z.enum(["persona_gate", "persona_quality", "recurring_theme"]),
  key: z.string(),
  count: z.number().int(),
  evidence: z.string(),
});
export type KonsoulFactSignal = z.infer<typeof KonsoulFactSignalSchema>;

/** Eine Studienzeile im Fakten-Block. Alle Zahlen sind tool-berechnet; das
 *  Frontend rendert sie lokalisiert (ICU) NEBEN der Prosa, damit das Modell sie
 *  nicht umschreiben kann. `completedSessions:null` → Frontend zeigt '—". */
export const PortfolioStudyFactSchema = z.object({
  studyId: z.string(),
  title: z.string(),
  status: z.string(),
  /** Abgeschlossene Interviews; null = Lesefehler → '—', NIE geraten. */
  completedSessions: z.number().int().nullable(),
  hasSynthesis: z.boolean(),
  hasPersonas: z.boolean().optional(),
  basedOnCount: z.number().int().optional(),
  synthesizedAt: z.string().nullable().optional(),
  newInterviewsSince: z.number().int().optional(),
});
export type PortfolioStudyFact = z.infer<typeof PortfolioStudyFactSchema>;

/** Der strukturierte Fakten-Block. NUR Zahlen, die ein Read-Tool deterministisch
 *  berechnet hat — der Burggraben gegen erfundene Zahlen. */
export const PortfolioFactsSchema = z.object({
  scope: z.enum(["portfolio", "study"]),
  poolSize: z.number().int().optional(),
  studies: z.array(PortfolioStudyFactSchema),
  konsoulSignals: z.array(KonsoulFactSignalSchema).optional(),
});
export type PortfolioFacts = z.infer<typeof PortfolioFactsSchema>;

// ── KonsoulResult — der UNIFIED Typ mit `kind`-Diskriminante ──────────────────

/** Ein Zitat — identisch zur Cross-Study/Mission-Control-Form, damit grounded/
 *  interpretation byte-gleich durchgereicht werden. */
export const KonsoulCitationSchema = MissionControlCitationSchema;
export type KonsoulCitation = z.infer<typeof KonsoulCitationSchema>;

/** kind:'grounded' — ERBT EXAKT die gefilterte Cross-Study-Antwort. EINZIGER
 *  grüner Pip. Zitate sind anker-überlebt (≥1), verbatim aus dem Cross-Study. */
export const KonsoulGroundedResultSchema = z.object({
  kind: z.literal("grounded"),
  answered: z.literal(true),
  answer: z.string(),
  citations: z.array(KonsoulCitationSchema),
});
export type KonsoulGroundedResult = z.infer<typeof KonsoulGroundedResultSchema>;

/** kind:'interpretation' — amber. Cross-Study answered=true MIT interpretation.
 *  Nie als Fakt. */
export const KonsoulInterpretationResultSchema = z.object({
  kind: z.literal("interpretation"),
  answered: z.literal(true),
  answer: z.string(),
  citations: z.array(KonsoulCitationSchema),
  interpretation: z.string(),
});
export type KonsoulInterpretationResult = z.infer<
  typeof KonsoulInterpretationResultSchema
>;

/** kind:'guidance' — NEUTRAL. Hilfe/How-to/Portfolio-Status. KEIN grüner Pip,
 *  KEINE Zitate. Harte Zahlen NUR in `data` (vom Tool), `sources` = Korpus-Keys. */
export const KonsoulGuidanceResultSchema = z.object({
  kind: z.literal("guidance"),
  /** 'beantwortet' im Sinne von erledigt, NICHT 'belegt'. */
  answered: z.literal(true),
  answer: z.string(),
  /** help-corpus-Keys (z.B. 'synthesis.howto'), KEINE studyIds. */
  sources: z.array(z.string()).optional(),
  /** Deterministische Zahlen — als Fakten-Block, nie in Modell-Prosa eingebacken. */
  data: PortfolioFactsSchema.optional(),
});
export type KonsoulGuidanceResult = z.infer<
  typeof KonsoulGuidanceResultSchema
>;

/** kind:'refusal' — RUHIG, nie rot. Keine belegbare/beantwortbare Evidenz. */
export const KonsoulRefusalResultSchema = z.object({
  kind: z.literal("refusal"),
  answered: z.literal(false),
  answer: z.string(),
  citations: z.array(KonsoulCitationSchema),
});
export type KonsoulRefusalResult = z.infer<typeof KonsoulRefusalResultSchema>;

/**
 * Der vereinheitlichte Response-Typ. Das Frontend rendert ausschließlich nach
 * `kind` (prüft `kind==='guidance'` ZUERST, fällt dann in die heutige
 * answered-Logik für grounded/interpretation/refusal).
 */
export const KonsoulResultSchema = z.discriminatedUnion("kind", [
  KonsoulGroundedResultSchema,
  KonsoulInterpretationResultSchema,
  KonsoulGuidanceResultSchema,
  KonsoulRefusalResultSchema,
]);
export type KonsoulResult = z.infer<typeof KonsoulResultSchema>;

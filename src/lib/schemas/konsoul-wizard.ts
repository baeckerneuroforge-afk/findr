import { z } from "zod";

/**
 * Konsoul WIZARD-BERATER — Verträge + reine Sanitisierung.
 * ----------------------------------------------------------------------------
 * PURE Modul (nur `zod`, KEIN `server-only`, KEINE Client-Komponenten-Importe):
 * dieselbe Datei wird von der Server-Engine, der Route UND der Client-Komponente
 * importiert (für die clientseitige Belt-and-Suspenders-Validierung vor `patch()`).
 *
 * Der Berater gibt eine kurze Antwort (`answer`) + optional konkrete
 * Feld-Vorschläge zurück, die der Mensch per Klick in den Wizard-State übernimmt.
 * Die Enum-Werte spiegeln 1:1 den Wizard-/Plan-Vertrag (types.ts → useCase,
 * audienceType, interviewDepth) — hier lokal gehalten, damit das Modul rein bleibt.
 *
 * EHRLICHKEIT/SICHERHEIT: Das Modell liefert nur ROHE Vorschläge; die
 * deterministische `sanitizeWizardSuggestions()` ist der einzige Pfad in den
 * State. Sie verwirft Enum-Vorschläge, deren `value` kein erlaubtes Token ist
 * (ein erfundenes useCase würde sonst den Select sprengen), no-op-Vorschläge
 * (gleich dem aktuellen Wert), leere Felder, und kappt Freitext + Anzahl. So
 * kann ein halluzinierter Vorschlag den Wizard NIE in einen kaputten Zustand
 * schreiben.
 */

// ── Vertrags-Enums (Spiegel von guided-study/types.ts) ───────────────────────

export const WIZARD_USE_CASES = [
  "general_survey",
  "brand_research",
  "concept_test",
  "creative_test",
  "usability_test",
] as const;
export type WizardUseCase = (typeof WIZARD_USE_CASES)[number];

export const WIZARD_AUDIENCE_TYPES = ["b2b", "b2c"] as const;
export type WizardAudienceType = (typeof WIZARD_AUDIENCE_TYPES)[number];

export const WIZARD_DEPTHS = ["flach", "mittel", "tief"] as const;
export type WizardDepth = (typeof WIZARD_DEPTHS)[number];

/** Die Setup-Felder, für die Konsoul Werte vorschlagen DARF. Bewusst KEINE
 *  Modus-/Analytics-/Material-Felder (die hängen an Compliance/Material-Pflichten;
 *  Phase 1 bleibt bei den vier ziel-formenden Feldern + Titel). */
export const WIZARD_SUGGESTABLE_FIELDS = [
  "briefing",
  "persona",
  "title",
  "useCase",
  "audienceType",
  "interviewDepth",
] as const;
export type WizardSuggestableField = (typeof WIZARD_SUGGESTABLE_FIELDS)[number];

/** Längen-Caps für Freitext-Vorschläge (briefing/persona/title). Enum-Felder
 *  bekommen formal auch einen Cap, damit der Record total ist — sie laufen aber
 *  nie durch den Trim-Pfad (sie werden vorher per Allowlist geprüft). */
const SUGGESTION_VALUE_CAP: Record<WizardSuggestableField, number> = {
  briefing: 2000,
  persona: 240,
  title: 160,
  useCase: 64,
  audienceType: 16,
  interviewDepth: 16,
};

/** Harte Anzeige-Obergrenze für Vorschläge (eine pro Feld, danach Schnitt). Das
 *  Modell wird im Prompt zusätzlich auf ≤3 genudgt (weniger = fokussierter); die
 *  4 lässt etwas Spielraum, falls es doch vier gleichwertige liefert. */
export const MAX_WIZARD_SUGGESTIONS = 4;

// ── Request (Client → Route) ─────────────────────────────────────────────────

/** Schnappschuss des aktuellen Wizard-Stands. Caps sind GROSSZÜGIG (kein 400 bei
 *  langem Briefing); die Engine kürzt für den Prompt selbst. */
export const WizardSnapshotSchema = z.object({
  briefing: z.string().max(8000),
  title: z.string().max(600),
  persona: z.string().max(1000),
  audienceType: z.enum(WIZARD_AUDIENCE_TYPES),
  useCase: z.enum(WIZARD_USE_CASES),
  interviewDepth: z.enum(WIZARD_DEPTHS),
  voiceEnabled: z.boolean(),
  // step = interner Wizard-Index 0..2 (0 Setup · 1 Leitfaden · 2 Start/Review),
  // NICHT die vier angezeigten Fortschritts-Labels. setStep/onEdit erreichen nie
  // > 2, daher ist max(2) korrekt und wirft keinen 400 bei echten Snapshots.
  step: z.number().int().min(0).max(2),
  topicCount: z.number().int().min(0).max(50),
});
export type WizardSnapshot = z.infer<typeof WizardSnapshotSchema>;

export const WizardAdvisorRequestSchema = z.object({
  wizard: WizardSnapshotSchema,
  question: z.string().max(500).optional(),
});
export type WizardAdvisorRequest = z.infer<typeof WizardAdvisorRequestSchema>;

// ── Modell-Ausgabe (was Opus emittiert, VOR Sanitisierung) ───────────────────

export const WizardAdvisorSuggestionSchema = z.object({
  field: z.enum(WIZARD_SUGGESTABLE_FIELDS),
  value: z.string().min(1).max(4000),
  label: z.string().min(1).max(160),
  rationale: z.string().min(1).max(400),
});
export type WizardAdvisorRawSuggestion = z.infer<
  typeof WizardAdvisorSuggestionSchema
>;

export const WizardAdvisorRawResultSchema = z.object({
  answer: z.string().min(1).max(1600),
  suggestions: z.array(WizardAdvisorSuggestionSchema).max(8).optional(),
});
export type WizardAdvisorRawResult = z.infer<
  typeof WizardAdvisorRawResultSchema
>;

// ── Sanitisiertes Ergebnis (Route → Client) ──────────────────────────────────

export interface WizardAdvisorSuggestion {
  field: WizardSuggestableField;
  value: string;
  label: string;
  rationale: string;
}

export interface WizardAdvisorResult {
  answer: string;
  suggestions: WizardAdvisorSuggestion[];
}

// ── Reine Sanitisierung (der EINZIGE Pfad in den State) ───────────────────────

function isMember(arr: readonly string[], v: string): boolean {
  return arr.includes(v);
}

/**
 * Verwandelt rohe Modell-Vorschläge in die sichere, anzeigbare Liste. PURE +
 * deterministisch (Unit-testbar). Verwirft:
 *   - Enum-Vorschläge (useCase/audienceType/interviewDepth), deren `value` kein
 *     erlaubtes Token ist  → kein kaputter Select,
 *   - no-op-Vorschläge (value == aktueller Wert),
 *   - leeren value/label/rationale,
 * kappt Freitext auf den Feld-Cap, erlaubt EINEN Vorschlag pro Feld und schneidet
 * bei MAX_WIZARD_SUGGESTIONS.
 */
export function sanitizeWizardSuggestions(
  raw: WizardAdvisorRawSuggestion[] | undefined,
  current: Pick<
    WizardSnapshot,
    "useCase" | "audienceType" | "interviewDepth"
  >,
): WizardAdvisorSuggestion[] {
  if (!raw || raw.length === 0) return [];
  const out: WizardAdvisorSuggestion[] = [];
  const seenFields = new Set<WizardSuggestableField>();

  for (const s of raw) {
    if (seenFields.has(s.field)) continue; // genau ein Vorschlag pro Feld

    let value = s.value.trim();
    if (value === "") continue;

    if (s.field === "useCase") {
      if (!isMember(WIZARD_USE_CASES, value)) continue;
      if (value === current.useCase) continue;
    } else if (s.field === "audienceType") {
      if (!isMember(WIZARD_AUDIENCE_TYPES, value)) continue;
      if (value === current.audienceType) continue;
    } else if (s.field === "interviewDepth") {
      if (!isMember(WIZARD_DEPTHS, value)) continue;
      if (value === current.interviewDepth) continue;
    } else {
      const cap = SUGGESTION_VALUE_CAP[s.field];
      if (value.length > cap) value = value.slice(0, cap).trimEnd();
    }

    const label = s.label.trim();
    const rationale = s.rationale.trim();
    if (label === "" || rationale === "") continue;

    out.push({ field: s.field, value, label, rationale });
    seenFields.add(s.field);
    if (out.length >= MAX_WIZARD_SUGGESTIONS) break;
  }

  return out;
}

/** Clientseitiger Belt-and-Suspenders-Check vor `patch()`: stellt sicher, dass
 *  ein Enum-Vorschlag wirklich ein erlaubtes Token trägt (die Route sanitisiert
 *  bereits — dies ist die zweite Wand direkt am State-Setter). */
export function isValidSuggestionValue(
  field: WizardSuggestableField,
  value: string,
): boolean {
  if (field === "useCase") return isMember(WIZARD_USE_CASES, value);
  if (field === "audienceType") return isMember(WIZARD_AUDIENCE_TYPES, value);
  if (field === "interviewDepth") return isMember(WIZARD_DEPTHS, value);
  return value.trim() !== "";
}

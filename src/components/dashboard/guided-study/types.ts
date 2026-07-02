import type { TopicDraft } from "@/components/dashboard/TopicEditor";
import type { PrototypeHosting } from "@/lib/research/task";

/**
 * Zustand + Metadaten des gefuehrten Studien-Wizards (Markt-Studien).
 *
 * Die Enums spiegeln 1:1 die Backend-Verträge (POST/PATCH /api/research/plans):
 * useCase, audienceType, interviewDepth, language. Roh-Eingaben (sampleTarget,
 * maxRounds, maxDurationMinutes) bleiben Strings und werden erst beim Anlegen
 * geparst — exakt wie die bestehende ResearchPlanForm.
 */

export type UseCase =
  | "general_survey"
  | "brand_research"
  | "concept_test"
  | "creative_test"
  | "usability_test";

export type AudienceType = "b2b" | "b2c";
export type Depth = "flach" | "mittel" | "tief";
export type Language = "de" | "en";

export interface WizardState {
  /** Schritt 1 — Briefing = Forschungsziel (objective). */
  briefing: string;
  /** E1 — optionaler Unternehmens-/Produkt-/Ideen-Kontext. Fließt in die
   *  Leitfaden-Generierung (KONTEXT-Block) und wird am Plan persistiert.
   *  Wird beim Mount aus dem Org-Profil vorbefüllt (E3), bleibt pro Studie
   *  editierbar. Leer = kein Kontext → Verhalten wie vorher. */
  businessContext: string;

  /** Schritt 2 — Vorschlag. */
  title: string;
  persona: string;
  sampleTarget: string;
  audienceType: AudienceType;
  useCase: UseCase;
  topics: TopicDraft[];
  /** Bedingte Aufgabe (usability_test). Das Material (concept_test/creative_test)
   *  lebt NICHT im WizardState, sondern als echte /stimuli-Zeilen am Draft-Plan
   *  (siehe StimulusUploader). */
  taskInstruction: string;
  taskTargetUrl: string;
  /** B2 (2026-07-02): Erfolgskriterium fürs advisory KI-Urteil (Phase C) —
   *  vorher hartkodiert null, wodurch Wizard-Studien NIE gejudgt wurden. */
  taskSuccessCriterion: string;
  /** B2: Hosting-Wahl (Default external_url — der ehrliche Default für fremde
   *  Prototypen; first_party_iframe rendert das messbare iframe-Panel). */
  taskPrototypeHosting: PrototypeHosting;

  /** Schritt 3 — Interview. */
  voiceEnabled: boolean;
  interviewDepth: Depth;
  language: Language;
  maxRounds: string;
  maxDurationMinutes: string;
  visualCaptureEnabled: boolean;
  eventTrackingEnabled: boolean;
  signalsEnabled: boolean;
  ttsEnabled: boolean;
}

export function initialWizardState(): WizardState {
  return {
    briefing: "",
    businessContext: "",
    title: "",
    persona: "",
    sampleTarget: "",
    audienceType: "b2c",
    useCase: "general_survey",
    topics: [],
    taskInstruction: "",
    taskTargetUrl: "",
    taskSuccessCriterion: "",
    taskPrototypeHosting: "external_url",
    voiceEnabled: false,
    interviewDepth: "mittel",
    language: "de",
    maxRounds: "",
    maxDurationMinutes: "",
    visualCaptureEnabled: false,
    eventTrackingEnabled: false,
    signalsEnabled: false,
    ttsEnabled: false,
  };
}

/** Use-Case-Metadaten — labelKey/hintKey zeigen in research.wizard. */
export const USE_CASES: {
  id: UseCase;
  labelKey: string;
  hintKey: string;
  needsStimulus: boolean;
  needsTask: boolean;
}[] = [
  { id: "general_survey", labelKey: "ucGeneralSurvey", hintKey: "ucGeneralSurveyHint", needsStimulus: false, needsTask: false },
  { id: "brand_research", labelKey: "ucBrand", hintKey: "ucBrandHint", needsStimulus: false, needsTask: false },
  { id: "concept_test", labelKey: "ucConcept", hintKey: "ucConceptHint", needsStimulus: true, needsTask: false },
  { id: "creative_test", labelKey: "ucCreative", hintKey: "ucCreativeHint", needsStimulus: true, needsTask: false },
  { id: "usability_test", labelKey: "ucUsability", hintKey: "ucUsabilityHint", needsStimulus: false, needsTask: true },
];

export function getUseCaseMeta(id: UseCase) {
  return USE_CASES.find((u) => u.id === id) ?? USE_CASES[0];
}

/** Tiefe-Metadaten — labelKey/metaKey zeigen in research.wizard. */
export const DEPTHS: { id: Depth; labelKey: string; metaKey: string }[] = [
  { id: "flach", labelKey: "depthFlach", metaKey: "depthFlachMeta" },
  { id: "mittel", labelKey: "depthMittel", metaKey: "depthMittelMeta" },
  { id: "tief", labelKey: "depthTief", metaKey: "depthTiefMeta" },
];

/** Shape von POST /api/research/plans/[id]/guide (muss InterviewGuide spiegeln —
 *  hier inline, damit der Client das server-only Engine-Modul nicht importiert). */
export interface GeneratedGuide {
  title: string;
  objective: string;
  estimatedMinutes: number;
  topics: Array<{
    id: string;
    label: string;
    goalLink: string;
    mainQuestion: string;
    probes: string[];
  }>;
  screeningQuestions?: string[];
}

export const FAKE_THINKING_MIN_MS = 600;

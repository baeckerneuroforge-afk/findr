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

// ── CalendarFacts (deterministischer KALENDER-Datenblock, scope:'calendar') ───

/** Eine Studie aus Kalender-Sicht: Status + Aktivierungs-Zustand + (geplantes/
 *  erfolgtes) Datum. Reine deterministische Felder aus listResearchPlans, nie
 *  modell-erfunden, KEINE PII (kein „wer hat terminiert"). Das `scheduledActivationAt`
 *  ist eine ISO-Zeit, die die UI rendert (das Modell darf sie nicht erfinden). */
export const CalendarStudyFactSchema = z.object({
  studyId: z.string(),
  title: z.string(),
  status: z.string(),
  /** none | scheduled | activating | activated | failed (orthogonal zu status). */
  activationState: z.string(),
  scheduledActivationAt: z.string().nullable(),
  activatedAt: z.string().nullable(),
});
export type CalendarStudyFact = z.infer<typeof CalendarStudyFactSchema>;

/** Der Kalender-Fakten-Block. Parallel zu PortfolioFacts (eigener scope), reine
 *  Zahlen/Zustände — der Burggraben gilt genauso (Modell nennt nur diese Werte). */
export const CalendarFactsSchema = z.object({
  scope: z.literal("calendar"),
  studies: z.array(CalendarStudyFactSchema),
  /** Entwürfe ohne Termin (activation_state='none' & status='draft'). */
  unscheduledDrafts: z.number().int(),
  /** Terminierte Studien (activation_state='scheduled'). */
  scheduledCount: z.number().int(),
  /** Geplante Termine in der Vergangenheit, nie manuell aktiviert. */
  overdueCount: z.number().int(),
});
export type CalendarFacts = z.infer<typeof CalendarFactsSchema>;

/** Der vereinheitlichte Fakten-Block, der an guidance/proposal `data` hängt:
 *  Portfolio/Study ODER Kalender. Beide tragen `studies[].studyId/title/status`,
 *  sodass die Engine eine studyId scope-unabhängig validieren kann. */
export const KonsoulFactsSchema = z.union([
  PortfolioFactsSchema,
  CalendarFactsSchema,
]);
export type KonsoulFacts = z.infer<typeof KonsoulFactsSchema>;

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
  /** Deterministische Zahlen — als Fakten-Block (Portfolio ODER Kalender), nie in
   *  Modell-Prosa eingebacken. */
  data: KonsoulFactsSchema.optional(),
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

// ── kind:'proposal' (P3 — additiv, flag-gated, NIE selbst ausführend) ─────────

/** Die GENAU VIER erlaubten Aktionen (Allowlist, fail-closed, Whitelist statt
 *  Blacklist). Jeder andere Endpunkt ist für Konsoul verboten und existiert als
 *  Aktion NICHT. VERBOTEN (nie hier): publish/Prolific, invites, invite-from-
 *  pool, open-link, panel/*, screening/quotas, participants, stimuli, share,
 *  chat. Diese Enum-Liste ist der einzige Ort, an dem die vier Typen leben — der
 *  Tabellen-CHECK (konsoul_action_log.action_type) ist der DB-seitige Backstop. */
export const KonsoulActionTypeSchema = z.enum([
  "create_study_draft",
  "run_synthesis",
  "run_personas",
  "run_guide",
  // Kalender: einen ENTWURF für ein zukünftiges Aktivierungs-Datum terminieren.
  // Der Confirm öffnet den BESTEHENDEN Termin-Picker (Mensch wählt die Zeit) →
  // bestehende /schedule-Route; verschickt NICHTS (≠ /activate). Nie ein Datum
  // vom Modell.
  "schedule_activation",
]);
export type KonsoulProposalActionType = z.infer<typeof KonsoulActionTypeSchema>;

/** Deterministische Vorbedingung — von der ENGINE aus `acc.data` (PortfolioFacts)
 *  gebaut, NIE aus Modell-Prosa. Treibt die Confirm-Stärke + Kosten-Hinweis im
 *  Frontend. Reine Zahlen/Flags, kein Synthese-/Persona-Inhalt. */
export const KonsoulProposalPreconditionSchema = z.object({
  /** Interviews, auf denen eine Synthese/Personas fußen würde (aus PortfolioFacts). */
  basedOnCount: z.number().int().optional(),
  /** Abgeschlossene Interviews der Zielstudie (für „erstmalig erzeugen?"). */
  completedSessions: z.number().int().nullable().optional(),
  /** Existiert schon eine Synthese? (für die Re-Run-Überschreib-Warnung.) */
  hasSynthesis: z.boolean().optional(),
  /** Existieren schon Personas? */
  hasPersonas: z.boolean().optional(),
  /** Kalender: aktueller Aktivierungs-Zustand (none|scheduled|…) für die
   *  schedule_activation-Confirm-Karte. */
  activationState: z.string().optional(),
});
export type KonsoulProposalPrecondition = z.infer<
  typeof KonsoulProposalPreconditionSchema
>;

/** Der eigentliche Vorschlag. Die ENGINE baut ihn deterministisch (actionType +
 *  studyId engine-validiert gegen PortfolioFacts; precondition/destructive/
 *  costsModel aus acc.data). Das Modell liefert NUR actionType + studyId/Felder +
 *  die freie `rationale`-Prosa. */
export const KonsoulProposalSchema = z.object({
  actionType: KonsoulActionTypeSchema,
  /** Zielstudie bei Re-Run-Aktionen (run_synthesis/run_personas/run_guide).
   *  Engine-validiert gegen den geladenen PortfolioFacts-Block — eine fremde/
   *  halluzinierte id wird NIE zum Vorschlag (→ is_error + Nudge). Fehlt bei
   *  create_study_draft. */
  targetStudyId: z.string().optional(),
  /** Vorgeschlagener Titel — NUR bei create_study_draft (Studienfeld). */
  targetTitle: z.string().optional(),
  /** Deterministische Vorbedingung aus acc.data (nie Modell-Prosa). */
  precondition: KonsoulProposalPreconditionSchema.optional(),
  /** true, wenn der Confirm ein bestehendes Artefakt ersetzt (run_synthesis/
   *  run_personas bei vorhandenem Datensatz; run_guide bei befülltem topic_script).
   *  Triggert im Frontend die stärkere 2-Schritt-Bestätigung. Aus acc.data. */
  destructive: z.boolean(),
  /** true, wenn der Confirm einen Opus-Lauf (Kosten) auslöst — alles außer
   *  create_study_draft. Aus dem actionType abgeleitet, nie aus Modell-Prosa. */
  costsModel: z.boolean(),
});
export type KonsoulProposal = z.infer<typeof KonsoulProposalSchema>;

/**
 * kind:'proposal' — Konsoul SCHLÄGT eine sichere Aktion VOR; der Mensch
 * entscheidet per Confirm-Klick. KEINE Ausführung in der Engine: dieser Envelope
 * trägt nur die Beschreibung des Vorschlags. Die Ausführung lebt ausschließlich
 * im Frontend-Confirm-Klick gegen den BESTEHENDEN org-scoped Endpunkt (POST
 * /plans, /[id]/synthesis|personas|guide), der orgId via requireOrgIdOrError aus
 * der Session zieht — NIE über /api/konsoul-agent, NIE ein Auto-Submit.
 *
 * `answered:true` = „der Vorschlag ist formuliert", NICHT „belegt": KEIN grüner
 * Pip, KEINE Zitate. `rationale` ist Modell-Prosa fürs UI und wird NIE
 * persistiert (das Audit trägt nur Metadaten — kein Freitext-Feld).
 */
export const KonsoulProposalResultSchema = z.object({
  kind: z.literal("proposal"),
  answered: z.literal(true),
  /** Modell-Prosa: warum diese Aktion jetzt sinnvoll ist. UI-only, NIE persistiert. */
  rationale: z.string(),
  proposal: KonsoulProposalSchema,
  /** Audit-Zeilen-ID (aus logProposed). Reist mit, damit der Confirm-/Dismiss-
   *  Beacon (POST /api/konsoul-agent/decision) GENAU diese 'proposed'-Zeile auf
   *  accepted/ignored setzen kann. null/fehlend, wenn die proposed-Schreibung
   *  fail-open schlug → die Decision wird dann zum No-op. Eine UUID, NIE PII. */
  auditId: z.string().nullable().optional(),
  /** Belegter Kontext für die Confirm-Karte (wie bei guidance; Portfolio ODER
   *  Kalender). */
  data: KonsoulFactsSchema.optional(),
});
export type KonsoulProposalResult = z.infer<
  typeof KonsoulProposalResultSchema
>;

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
  // P3 — additiv, flag-gated. Ist das Aktions-Flag aus, baut die Engine NIE einen
  // 'proposal'; der Zweig existiert nur im Schema und ändert die vier Altzweige
  // byte-gleich nicht. assertKonsoulResult deckt ihn automatisch mit ab.
  KonsoulProposalResultSchema,
]);
export type KonsoulResult = z.infer<typeof KonsoulResultSchema>;

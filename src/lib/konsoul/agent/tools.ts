import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import {
  loadOrgSyntheses,
  loadOrgPersonaPlanIds,
} from "@/lib/mission-control/engine";
import type { MissionControlSynthesisInput } from "@/lib/mission-control/prompts";
import {
  listResearchPlans,
  countCompletedSessionsForPlans,
  type ResearchPlanRecord,
} from "@/lib/research/plans-service";
import { countPoolMembers } from "@/lib/research/participant-pool";
import { computeKonsoulSignals } from "@/lib/konsoul/signals";
import type { KonsoulSignal } from "@/lib/konsoul/signals";
import {
  type PortfolioFacts,
  type PortfolioStudyFact,
  type KonsoulFactSignal,
  type CalendarFacts,
  type CalendarStudyFact,
} from "@/lib/schemas/konsoul-agent";
import {
  lookupHelpTopic,
  listHelpTopicsForTool,
  resolveHelpTopicKey,
  type HelpLocale,
} from "./help-corpus";

/**
 * Konsoul-Read-Tools (P2) — STRIKT lesend, org-scoped per CLOSURE.
 *
 * Die `orgId` wird in `makeKonsoulReadTools(orgId)` EINMAL geschlossen und nie
 * als Modell-Argument oder Tool-Input akzeptiert — Cross-Org-Zugriff ist damit
 * konstruktiv unmöglich (Plan §6 / Andrés Vorgabe). Kein Tool mutiert, versendet
 * oder berührt Teilnehmer-PII/Rohtext/Affekt.
 *
 * VERBOTEN gebunden (PII / Art. 22, nicht verhandelbar): listPoolMembers,
 * getPoolMember, listSessionsForPlan, getSessionWithTranscript,
 * listInvitedPoolMemberIds. Pool erscheint NUR als Zahl (countPoolMembers).
 * Synthese-INHALT (Themen/Quotes) verlässt das Modell ausschließlich über den
 * delegierten Cross-Study-Agenten (anker-geprüft) — get_study_status spielt
 * Synthese NUR als Flags/Counts aus, nie Prosa.
 *
 * Die harten Portfolio-Zahlen reisen als strukturierter `PortfolioFacts`-Block
 * (deterministisch, count:"exact"/JS-Aggregation), getrennt von der Modell-
 * Prosa. Das Modell darf in `answer` nur Zahlen nennen, die wörtlich hier stehen.
 *
 * Wie der Cross-Study-Agent läuft das hinter einem DI-Toolset
 * (KonsoulReadToolset), damit der Unit-Test deterministisch ohne Supabase/API
 * fahren kann.
 */

// ── DI-Toolset (die Naht zwischen Loop und Daten) ────────────────────────────

/** Read-only Org-Aggregate. Jede Methode liefert verbatim DB-Counts/Flags (oder
 *  ihren Fixture-Ersatz im Test). KEINE Mutation, KEINE PII. */
export interface KonsoulReadToolset {
  /** Portfolio-weiter Fakten-Block: alle Studien als Status/Counts + Pool-Größe
   *  + deterministische Konsoul-Signale. scope:'portfolio'. */
  getPortfolioFacts(): Promise<PortfolioFacts>;
  /** Fakten-Block EINER Studie (Status/Counts/Flags), oder null bei unbekannter
   *  id in dieser Org. scope:'study'. KEINE Synthese-Prosa. */
  getStudyFacts(studyId: string): Promise<PortfolioFacts | null>;
  /** KALENDER-Fakten: pro Studie Status + Aktivierungs-Zustand + (geplantes)
   *  Datum, plus deterministische Zähler. scope:'calendar'. KEINE PII, KEIN
   *  Versand — reiner Lese-Snapshot. */
  getCalendarFacts(): Promise<CalendarFacts>;
}

// ── Pure Builder (kein DB — testbar) ─────────────────────────────────────────

/** Projektion eines Signals auf den schmalen Fakten-Eintrag (Zahl + Schlüssel +
 *  knappe, PII-freie Evidenz-Beschriftung). */
export function toFactSignal(s: KonsoulSignal): KonsoulFactSignal {
  const evidence =
    s.evidence.type === "plan"
      ? s.evidence.planTitle
      : `${s.evidence.theme} (${s.evidence.studyTitles.length} Studien)`;
  return { kind: s.kind, key: s.key, count: s.count, evidence };
}

/**
 * Baut den portfolio-weiten Fakten-Block aus bereits geladenen Inputs. PURE: kein
 * DB, kein Netzwerk, kein Modell. Jede Zahl ist hier hereingereicht (von den
 * org-Reads), nie geschätzt.
 *
 * - `completedByPlan === null` (Batch-Lesefehler) → completedSessions:null pro
 *   Studie → Frontend rendert '—", NIE 0.
 * - hasSynthesis/basedOnCount/synthesizedAt stammen aus loadOrgSyntheses-Daten
 *   (Synthese-METADATEN, kein Inhalt). hasPersonas: optionaler Flag-Input.
 */
export function buildPortfolioFacts(args: {
  plans: ResearchPlanRecord[];
  syntheses: MissionControlSynthesisInput[];
  completedByPlan: Map<string, number> | null;
  poolSize: number;
  signals: KonsoulSignal[];
  /** Optionaler studyId→hasPersonas-Flag (nur Bool, kein Persona-Inhalt). */
  hasPersonasByPlan?: Map<string, boolean>;
}): PortfolioFacts {
  const { plans, syntheses, completedByPlan, poolSize, signals } = args;
  const synthById = new Map(syntheses.map((s) => [s.studyId, s]));

  const studies: PortfolioStudyFact[] = plans.map((p) => {
    const synth = synthById.get(p.id);
    const completed = completedByPlan ? completedByPlan.get(p.id) ?? 0 : null;
    const fact: PortfolioStudyFact = {
      studyId: p.id,
      title: p.title,
      status: p.status,
      completedSessions: completed,
      hasSynthesis: synth !== undefined,
    };
    if (synth) fact.basedOnCount = synth.basedOnCount;
    const hasPersonas = args.hasPersonasByPlan?.get(p.id);
    if (hasPersonas !== undefined) fact.hasPersonas = hasPersonas;
    return fact;
  });

  return {
    scope: "portfolio",
    poolSize,
    studies,
    konsoulSignals: signals.map(toFactSignal),
  };
}

/** Baut den Fakten-Block EINER Studie aus dem portfolio-weiten Block. PURE.
 *  null, wenn die studyId nicht zum Portfolio gehört (unbekannt/fremde Org). */
export function pickStudyFacts(
  portfolio: PortfolioFacts,
  studyId: string,
): PortfolioFacts | null {
  const study = portfolio.studies.find((s) => s.studyId === studyId);
  if (!study) return null;
  // NUR plan-scoped Signale betreffen GENAU diese Studie: persona_gate/-quality
  // tragen `<kind>-<studyId>`. recurring_theme ist per Definition STUDIEN-
  // ÜBERGREIFEND (Schlüssel `recurring_theme-<themen-titel>`, kein studyId) und
  // gehört NIE in den Status-Block einer einzelnen Studie — sonst hinge ein
  // Cross-Study-Signal über einen zufälligen Suffix-Treffer fälschlich an ihr.
  const signals = (portfolio.konsoulSignals ?? []).filter(
    (sig) =>
      (sig.kind === "persona_gate" || sig.kind === "persona_quality") &&
      sig.key.endsWith(`-${studyId}`),
  );
  return {
    scope: "study",
    studies: [study],
    ...(signals.length > 0 ? { konsoulSignals: signals } : {}),
  };
}

/**
 * Baut den KALENDER-Fakten-Block aus den geladenen Plänen. PURE: kein DB, kein
 * Modell. `nowMs` wird hereingereicht (deterministisch/testbar) und treibt NUR
 * den overdue-Zähler (geplanter Termin in der Vergangenheit, nie aktiviert).
 * activation_state/scheduled_activation_at stammen verbatim aus den Plänen; ein
 * fehlender Wert ist 'none'/null (coerceActivationState-Default, pre-migration-safe).
 */
export function buildCalendarFacts(
  plans: ResearchPlanRecord[],
  nowMs: number,
): CalendarFacts {
  const studies: CalendarStudyFact[] = plans.map((p) => ({
    studyId: p.id,
    title: p.title,
    status: p.status,
    activationState: p.activationState ?? "none",
    scheduledActivationAt: p.scheduledActivationAt ?? null,
    activatedAt: p.activatedAt ?? null,
  }));
  const unscheduledDrafts = plans.filter(
    (p) => p.status === "draft" && (p.activationState ?? "none") === "none",
  ).length;
  const scheduled = plans.filter((p) => p.activationState === "scheduled");
  const overdueCount = scheduled.filter((p) => {
    if (!p.scheduledActivationAt) return false;
    const t = Date.parse(p.scheduledActivationAt);
    return Number.isFinite(t) && t < nowMs;
  }).length;
  return {
    scope: "calendar",
    studies,
    unscheduledDrafts,
    scheduledCount: scheduled.length,
    overdueCount,
  };
}

// ── Deterministische Formatter (Tool-Result-Text fürs Modell) ────────────────

function formatNum(n: number | null): string {
  return n === null ? "—" : String(n);
}

/** Tool-Result-Text des Portfolio-/Study-Fakten-Blocks. Reine Zahlen/Flags,
 *  kein Modell-Urteil. Das Modell darf NUR diese Zahlen wiedergeben. */
export function formatPortfolioFactsForTool(facts: PortfolioFacts): string {
  const head =
    facts.scope === "portfolio"
      ? `PORTFOLIO: ${facts.studies.length} Studie(n)${
          facts.poolSize !== undefined ? `, ${facts.poolSize} Person(en) im Pool` : ""
        }. Gib NUR diese Zahlen wieder, schätze/runde/addiere nichts selbst.`
      : `STUDY-STATUS (gib NUR diese Zahlen wieder, schätze/runde/addiere nichts selbst):`;
  const lines = facts.studies.map((s) => {
    const parts = [
      `status=${s.status}`,
      `abgeschlossene Interviews=${formatNum(s.completedSessions)}`,
      s.hasSynthesis ? "Synthese: ja" : "Synthese: nein",
    ];
    if (s.basedOnCount !== undefined) parts.push(`based_on=${s.basedOnCount}`);
    if (s.hasPersonas !== undefined)
      parts.push(s.hasPersonas ? "Personas: ja" : "Personas: nein");
    return `- id=${s.studyId} "${s.title}" (${parts.join(", ")})`;
  });
  const sigs =
    facts.konsoulSignals && facts.konsoulSignals.length > 0
      ? `\nSIGNALE (deterministisch): ${facts.konsoulSignals
          .map((g) => `${g.kind}=${g.count} [${g.evidence}]`)
          .join("; ")}`
      : "";
  return `${head}\n${lines.join("\n")}${sigs}`;
}

/** Tool-Result-Text des KALENDER-Fakten-Blocks. Reine Zustände/Daten; das Modell
 *  darf NUR diese Werte wiedergeben und NIE ein Datum erfinden. */
export function formatCalendarFactsForTool(facts: CalendarFacts): string {
  const head = `KALENDER: ${facts.studies.length} Studie(n), ${facts.unscheduledDrafts} ungeplante(r) Entwurf/Entwürfe, ${facts.scheduledCount} terminiert, ${facts.overdueCount} überfällig. Gib NUR diese Zustände/Daten wieder, erfinde KEIN Datum. Du terminierst NICHTS selbst und aktivierst NIE — du schlägst höchstens via propose_action(schedule_activation) vor.`;
  const lines = facts.studies.map((s) => {
    const parts = [`status=${s.status}`, `aktivierung=${s.activationState}`];
    if (s.scheduledActivationAt) parts.push(`geplant=${s.scheduledActivationAt}`);
    if (s.activatedAt) parts.push(`aktiviert=${s.activatedAt}`);
    return `- id=${s.studyId} "${s.title}" (${parts.join(", ")})`;
  });
  return `${head}\n${lines.join("\n")}`;
}

/** Tool-Result-Text eines Hilfe-Themas. Neutral, du-Form; der Korpus-`key` wird
 *  separat als `sources` an die guidance-Antwort gehängt. */
export function formatHelpTopicForTool(topic: {
  key: string;
  title: string;
  text: string;
}): string {
  return `HELP key=${topic.key} "${topic.title}":\n${topic.text}\n(Fasse das knapp + neutral zusammen. Diese Antwort ist HILFE, nicht belegt — keine Zitate, kein grüner 'belegt'-Zustand.)`;
}

/** Tool-Result-Text der verfügbaren Hilfe-Themen, wenn das Modell einen
 *  unbekannten/leeren Help-Key anfragt — so kann es ehrlich umlenken. */
export function formatHelpIndexForTool(): string {
  const topics = listHelpTopicsForTool();
  const lines = topics.map(
    (t) => `  - key=${t.key} "${t.title}" (${t.aliases.slice(0, 4).join(", ")})`,
  );
  return `Kein passendes Hilfe-Thema unter diesem Schlüssel. Verfügbare Themen:\n${lines.join(
    "\n",
  )}\nWenn keines passt, antworte ehrlich, dass du dazu keine Hilfe hast.`;
}

// ── Anthropic-Tool-Definitionen (der Loop bietet diese an) ────────────────────

export const GET_PORTFOLIO_OVERVIEW_TOOL: Anthropic.Tool = {
  name: "get_portfolio_overview",
  description:
    "Liefert den DETERMINISTISCHEN Portfolio-Überblick dieser Organisation: jede Studie mit Status, Anzahl abgeschlossener Interviews, Synthese-Flag, sowie Pool-Größe und deterministische Konsoul-Signale. NUR Zahlen/Flags — KEINE Synthese-Inhalte, KEINE Zitate, KEINE Teilnehmerdaten. Nutze dies für breite Status-Fragen ('wie steht mein Portfolio?', 'wie viele Interviews laufen?', 'welche Studien haben noch keine Synthese?'). Die Zahlen reisen strukturiert zurück — gib nur diese wieder, schätze nie selbst. Nimmt keine Argumente.",
  input_schema: { type: "object", properties: {} },
};

export const GET_STUDY_STATUS_TOOL: Anthropic.Tool = {
  name: "get_study_status",
  description:
    "Liefert den DETERMINISTISCHEN Status EINER Studie per id (aus dem Portfolio-Überblick): Status, abgeschlossene Interviews, Synthese-Flag, based_on-Zahl. NUR Zahlen/Flags — KEINE Synthese-Prosa, KEINE Zitate, KEINE Teilnehmerdaten. Für 'wie steht Studie X?'. Wenn du die id nicht kennst, rufe zuerst get_portfolio_overview.",
  input_schema: {
    type: "object",
    properties: {
      studyId: {
        type: "string",
        description: "Die id einer Studie aus get_portfolio_overview.",
      },
    },
    required: ["studyId"],
  },
};

export const GET_CALENDAR_CONTEXT_TOOL: Anthropic.Tool = {
  name: "get_calendar_context",
  description:
    "Liefert den DETERMINISTISCHEN Kalender-Stand dieser Organisation: pro Studie Status + Aktivierungs-Zustand (none/scheduled/activating/activated/failed) + ggf. das geplante Aktivierungs-Datum, plus Zähler (ungeplante Entwürfe, terminiert, überfällig). NUR Zustände/Daten — KEINE Teilnehmerdaten, KEIN 'wer hat terminiert'. Nutze dies für Kalender-Fragen ('was ist diese Woche geplant?', 'welche Entwürfe sind ungeplant?', 'ist etwas überfällig?') UND BEVOR du eine Terminierung (schedule_activation) vorschlägst. Du erfindest NIE ein Datum und aktivierst NIE — du terminierst nur per Vorschlag. Nimmt keine Argumente.",
  input_schema: { type: "object", properties: {} },
};

export const GET_HELP_TOOL: Anthropic.Tool = {
  name: "get_help",
  description:
    "Liefert einen kuratierten How-to-Hilfetext zu einem Produkt-Thema (Synthese erstellen, Personas erzeugen, Studie anlegen, Interview-Tiefe, Pool/Einladung, Verteilung/Launch). Nutze dies für 'Wie mache ich X?'-Fragen. Übergib den passenden Themen-Schlüssel; kennst du ihn nicht, übergib ein kurzes Stichwort und du bekommst die verfügbaren Themen zurück. Die Antwort ist HILFE (neutral, nicht belegt) — niemals Zitate.",
  input_schema: {
    type: "object",
    properties: {
      topicKey: {
        type: "string",
        description:
          "Stabiler Themen-Schlüssel (z.B. 'synthesis.howto', 'personas.howto', 'study.create', 'interview.depth', 'pool.invite', 'launch.distribution') ODER ein kurzes Stichwort.",
      },
    },
    required: ["topicKey"],
  },
};

export const DELEGATE_CROSS_STUDY_TOOL: Anthropic.Tool = {
  name: "delegate_cross_study",
  description:
    "DELEGIERT eine inhaltliche Frage über die BEFUNDE/Themen der Studien (z.B. 'welche Themen tauchen studienübergreifend auf?', 'was sagen Teilnehmer über X?', 'vergleiche Studie A und B') an den belegt arbeitenden Cross-Study-Analysten. NUR dieser Pfad darf Synthese-Inhalte und Zitate liefern (anker-geprüft). Nutze ihn für jede Frage, die echte Evidenz/Zitate aus den Interviews braucht — NICHT für reinen Status (das ist get_portfolio_overview) oder How-to (get_help). Übergib die inhaltliche Frage; die Antwort kommt belegt zurück.",
  input_schema: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description:
          "Die inhaltliche, belegbedürftige Frage über die Studien-Befunde (in der Sprache des Nutzers).",
      },
    },
    required: ["question"],
  },
};

/** Alle vier read-only Konsoul-Tools (P2), die der Orchestrator-Loop IMMER
 *  anbietet. Statisch exportiert für den PII-Negativtest (die gebundene Tool-
 *  Liste darf KEINES der verbotenen PII-Reads enthalten). Diese Liste bleibt
 *  byte-gleich zu P2 — das P3-Aktions-Tool wird NICHT hier gemischt, sondern
 *  über `konsoulToolDefs()` flag-gegated angehängt. */
export const KONSOUL_TOOL_DEFS: Anthropic.Tool[] = [
  GET_PORTFOLIO_OVERVIEW_TOOL,
  GET_STUDY_STATUS_TOOL,
  GET_HELP_TOOL,
  DELEGATE_CROSS_STUDY_TOOL,
];

// ── P3 propose_action (flag-gated, additiv, TERMINAL, NIE selbst ausführend) ──

/** Der EINE additive Aktions-Tool-Name (P3). Genau EINE Tool-Definition mit
 *  einem actionType-Enum der vier erlaubten Aktionen (statt vier Einzel-Tools →
 *  eine Validierungsstelle in der Engine). */
export const PROPOSE_ACTION_TOOL_NAME = "propose_action";

/** Die GENAU VIER erlaubten Aktionstypen (Allowlist, fail-closed). Single Source
 *  of Truth für das Tool-Enum UND den Engine-seitigen Validierungs-Backstop.
 *  VERBOTEN (existieren als Aktion NICHT): publish/Prolific, invites, invite-from-
 *  pool, open-link, panel/*, screening/quotas, participants, stimuli, share, chat. */
export const KONSOUL_PROPOSE_ACTION_TYPES = [
  "create_study_draft",
  "run_synthesis",
  "run_personas",
  "run_guide",
] as const;

/**
 * Das terminale `propose_action`-Tool (P3). Spiegelbild zu emit_guidance /
 * delegate_cross_study: das Modell liefert NUR Argumente (actionType aus dem 4er-
 * Enum + studyId/Titel + kurze rationale-Prosa fürs UI); die ENGINE baut den
 * Vorschlag deterministisch (kind:'proposal'), validiert studyId gegen
 * PortfolioFacts und führt NICHTS aus. KEINE orgId — die ist server-autoritativ
 * und das Modell sieht sie nie.
 *
 * NUR über `konsoulToolDefs()` angeboten, und auch nur bei aktivem Flag.
 */
export const PROPOSE_ACTION_TOOL: Anthropic.Tool = {
  name: PROPOSE_ACTION_TOOL_NAME,
  description:
    "SCHLÄGT dem Forscher eine SICHERE, org-seitige Aktion VOR (du führst sie NIE aus — der Mensch bestätigt sie per Klick). Nutze dies, wenn der Nutzer ausdrücklich eine dieser vier Aktionen anstößt ('leg mir einen Entwurf an', 'starte die Synthese', 'erzeuge Personas', 'generiere den Leitfaden'). Erlaubt sind GENAU VIER actionType-Werte: create_study_draft (neue Studien-Entwurfszeile; gib studyTitle), run_synthesis / run_personas / run_guide (auf eine BESTEHENDE Studie; gib studyId aus get_portfolio_overview). Für JEDE andere, teilnehmer- oder geld-nahe Aktion (etwa Veröffentlichen, Rekrutierung, Material- oder Link-Mutationen) hast du KEIN Tool — lehne sie ehrlich über emit_guidance ab. Du setzt NIE orgId. Übergib actionType, ggf. studyId/studyTitle und eine kurze deutsche Begründung (rationale).",
  input_schema: {
    type: "object",
    properties: {
      actionType: {
        type: "string",
        enum: [...KONSOUL_PROPOSE_ACTION_TYPES],
        description:
          "Eine der vier erlaubten Aktionen. Jeder andere Wert wird verworfen.",
      },
      studyId: {
        type: "string",
        description:
          "Die id einer BESTEHENDEN Studie aus get_portfolio_overview (Pflicht bei run_synthesis/run_personas/run_guide). Eine fremde/erfundene id wird verworfen.",
      },
      studyTitle: {
        type: "string",
        description:
          "Vorgeschlagener Titel der NEUEN Studie — NUR bei create_study_draft.",
      },
      rationale: {
        type: "string",
        description:
          "Kurze, neutrale deutsche Begründung, warum diese Aktion jetzt sinnvoll ist. Fürs UI — nenne nur tool-gelieferte Zahlen, schätze nicht.",
      },
    },
    required: ["actionType", "rationale"],
  },
};

/**
 * Die Tool-Liste, die der Orchestrator-Loop dem Modell anbietet. Bei AKTIVEM
 * Aktions-Flag wird `propose_action` additiv angehängt; sonst exakt das heutige
 * P2-Read-Toolset (byte-gleich). Das Emit-Tool (emit_guidance) mischt die Engine
 * separat dazu.
 *
 * Der Flag-Wert wird als Argument hereingereicht (kein Import von actions-flag
 * hier), damit diese Datei rein/testbar bleibt und der Aufrufer (Engine) die eine
 * Flag-Quelle besitzt.
 */
/** Aktionstypen INKL. Kalender-Terminierung — nur angeboten, wenn das Kalender-
 *  Flag an ist (gestapelt auf das Actions-Flag). schedule_activation öffnet beim
 *  Confirm den Picker (verschickt nichts); NIE /activate. */
export const KONSOUL_PROPOSE_ACTION_TYPES_WITH_CALENDAR = [
  ...KONSOUL_PROPOSE_ACTION_TYPES,
  "schedule_activation",
] as const;

/** Das propose_action-Tool MIT der Kalender-Aktion im actionType-Enum. Klon von
 *  PROPOSE_ACTION_TOOL — der einzige Unterschied ist der erweiterte Enum + ein
 *  Zusatz in der Beschreibung. Nur via konsoulToolDefs(.., calendarEnabled=true). */
export function proposeActionToolWithCalendar(): Anthropic.Tool {
  return {
    name: PROPOSE_ACTION_TOOL_NAME,
    description:
      PROPOSE_ACTION_TOOL.description +
      " ZUSÄTZLICH erlaubt (Kalender): schedule_activation — schlage vor, einen ENTWURF für ein zukünftiges Aktivierungs-Datum zu terminieren (gib die studyId). Du nennst KEIN Datum; der Confirm öffnet den Termin-Picker, der Mensch wählt die Zeit. Rufe vorher get_calendar_context. NUR Entwürfe sind terminierbar. Aktivieren/Live-Schalten/Versand kannst du NIE.",
    input_schema: {
      type: "object",
      properties: {
        ...(PROPOSE_ACTION_TOOL.input_schema.properties as Record<
          string,
          unknown
        >),
        actionType: {
          type: "string",
          enum: [...KONSOUL_PROPOSE_ACTION_TYPES_WITH_CALENDAR],
          description:
            "Eine der erlaubten Aktionen (inkl. schedule_activation). Jeder andere Wert wird verworfen.",
        },
      },
      required: ["actionType", "rationale"],
    },
  };
}

export function konsoulToolDefs(
  actionsEnabled: boolean,
  calendarEnabled = false,
): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [...KONSOUL_TOOL_DEFS];
  if (calendarEnabled) tools.push(GET_CALENDAR_CONTEXT_TOOL);
  if (actionsEnabled) {
    tools.push(
      calendarEnabled ? proposeActionToolWithCalendar() : PROPOSE_ACTION_TOOL,
    );
  }
  return tools;
}

// ── Production-Toolset (org-backed, read-only, orgId per Closure) ─────────────

/**
 * Baut das produktive read-only Toolset für EINE Org. `orgId` ist hier EINMAL
 * geschlossen und wird nie wieder als Argument akzeptiert.
 *
 * Fail-open je Read (Muster signals.ts / Heute-Seite): scheitert ein Teil-Read,
 * fällt sein Wert sicher aus (completedByPlan→null→'—", poolSize→0, signals→[]),
 * statt die ganze Antwort zu kippen. Die Engine bleibt darüber fail-closed für
 * Transport/Schema, aber der Fakten-Block degradiert ehrlich.
 *
 * AUTH-VERTRAG: der Aufrufer (Route) MUSS die orgId via requireOrgIdOrError
 * authentifiziert haben, bevor er dies baut — alle Reads sind eine org-scoped
 * Vertrauensgrenze.
 */
export function makeKonsoulReadTools(orgId: string): KonsoulReadToolset {
  // Pläne EINMAL pro Request laden (lazy, gecacht): Portfolio- UND Kalender-Tool
  // teilen sich denselben org-scoped Read statt ihn zu doppeln. Fail-open → [].
  let plansPromise: Promise<ResearchPlanRecord[]> | null = null;
  function loadPlans(): Promise<ResearchPlanRecord[]> {
    if (!plansPromise) {
      plansPromise = listResearchPlans(orgId, "market_research").catch(
        () => [] as ResearchPlanRecord[],
      );
    }
    return plansPromise;
  }

  async function loadPortfolioFresh(): Promise<PortfolioFacts> {
    // market_research-Scope (wie P1-Signale): das ist Konsouls Portfolio-Universe.
    // personaPlanIds: Set der plan_ids mit bereits erzeugten Personas (oder null
    // bei Lese-Fehler) — treibt die ehrliche run_personas-Überschreib-Warnung.
    const plans = await loadPlans();
    const [syntheses, signals, poolSize, personaPlanIds] = await Promise.all([
      loadOrgSyntheses(orgId).catch(() => [] as MissionControlSynthesisInput[]),
      computeKonsoulSignals(orgId).catch(() => [] as KonsoulSignal[]),
      countPoolMembers(orgId).catch(() => 0),
      loadOrgPersonaPlanIds(orgId).catch(() => null),
    ]);
    const completedByPlan =
      plans.length > 0
        ? await countCompletedSessionsForPlans(
            orgId,
            plans.map((p) => p.id),
          ).catch(() => null)
        : new Map<string, number>();
    // Nur bei erfolgreichem Read einen deterministischen true/false-Flag pro Plan
    // setzen; bei Lese-Fehler (null) hasPersonasByPlan WEGLASSEN → fact.hasPersonas
    // bleibt undefined → die Engine warnt konservativ (undefined && hasSynthesis).
    const hasPersonasByPlan = personaPlanIds
      ? new Map(plans.map((p) => [p.id, personaPlanIds.has(p.id)]))
      : undefined;
    return buildPortfolioFacts({
      plans,
      syntheses,
      completedByPlan,
      poolSize,
      signals,
      ...(hasPersonasByPlan ? { hasPersonasByPlan } : {}),
    });
  }

  // Pro Request EINMAL laden (lazy, gecacht): ruft das Modell im selben Lauf
  // get_portfolio_overview UND get_study_status, teilen sich beide denselben
  // org-scoped DB-Read statt das Portfolio doppelt zu laden. loadPortfolioFresh
  // ist fail-open je Teil-Read und wirft nicht → das gecachte Promise ist sicher.
  let portfolioPromise: Promise<PortfolioFacts> | null = null;
  function loadPortfolio(): Promise<PortfolioFacts> {
    if (!portfolioPromise) portfolioPromise = loadPortfolioFresh();
    return portfolioPromise;
  }

  // Kalender-Fakten teilen den Plan-Read; nowMs = Server-Zeit (nur für overdue).
  let calendarPromise: Promise<CalendarFacts> | null = null;
  function loadCalendar(): Promise<CalendarFacts> {
    if (!calendarPromise) {
      calendarPromise = loadPlans().then((plans) =>
        buildCalendarFacts(plans, Date.now()),
      );
    }
    return calendarPromise;
  }

  return {
    getPortfolioFacts: () => loadPortfolio(),
    getStudyFacts: async (studyId: string) =>
      pickStudyFacts(await loadPortfolio(), studyId),
    getCalendarFacts: () => loadCalendar(),
  };
}

// Re-export der Help-Lookups, damit die Engine genau EINE Tool-Schicht importiert.
export { lookupHelpTopic, resolveHelpTopicKey, type HelpLocale };

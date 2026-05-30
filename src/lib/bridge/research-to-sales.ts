import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import type { Database, Json } from "@/types/database";
import { RISK_SIGNAL_TYPES } from "@/lib/schemas/risk";

/**
 * Cross-Modul-Brücke #3 — Research-Synthese-Thema → Sales-Risk-Signal-Kandidat.
 *
 * Wenn eine Studien-Synthese ein wiederkehrendes, risiko-relevantes
 * Thema liefert (z.B. "Enterprise-Käufer sorgen sich um Integrationstiefe
 * mit ihrem ERP"), leitet diese Brücke daraus EINEN Risk-Signal-Kandidaten
 * ab — kurzer deutscher Name, gemappter RISK_SIGNAL_TYPES-Typ (oder
 * "UNKLASSIFIZIERT") + 1-Satz-Begründung mit Bezug zur Synthese-Evidenz.
 *
 * Architektur (drei harte Eigenschaften — wie #1):
 *
 *   (1) DERIVATION — EINE LLM-Surface, Opus default, KEIN Auto-Apply. Reines
 *       Pure-Input → Pure-Output für Eval + Production (gleiche Funktion).
 *
 *   (2) HUMAN-APPROVAL-GATE — wie #1/#2. Detector persistiert pending
 *       Vorschläge in bridge_suggestions (source_module='research',
 *       kind='research_to_risk'). Approval = pure state transition; KEIN
 *       Side-Effect (kein research_plan, keine health-score). Der approved-
 *       Status SELBST ist das Artefakt — er signalisiert: "Team bestätigt:
 *       dieses Muster ist real beobachtbar und sollte in Deal-Bewertungen
 *       mitgedacht werden." Die Watch-List rendert sich aus den approved-
 *       Zeilen.
 *
 *   (3) RE-USE OHNE SCHEMA-ERWEITERUNG — bridge_suggestions ist als loser
 *       Vertrag designed. kind='research_to_risk' ist ein neuer Wert, kein
 *       schema-Change nötig. RISK_SIGNAL_TYPES bleibt klassifizier-intern
 *       fix; der Kandidat dockt als Watch-Item an, NICHT als Classifier-
 *       Erweiterung. Bewusste Entkopplung: ein vom-Team-bestätigtes Muster
 *       ist ein menschlicher Watchpoint, kein Auto-Signal.
 *
 * COST GUARDRAIL:
 *   - Detector: O(themes) Opus-Calls beim ersten Scan; Dedup auf
 *     (planId, themeTitle) macht Re-Scans billig. Pre-Filter: themes mit
 *     frequency<2 werden NICHT zum LLM geschickt (das LLM würde sowieso
 *     refusen) — spart Tokens an dünnen Themen.
 *   - Eval: 6 Cases × 1 Call × 2 Modelle = 12 Calls (~ $2-3 Opus).
 */

// ── Tunable constants ──────────────────────────────────────────────────────

/** Pre-Filter-Schwelle: emergent_themes mit frequency unter diesem Wert
 *  werden gar nicht erst zum LLM geschickt. Spiegelt die im System-Prompt
 *  formulierte Refusal-Regel — der Detector ist dem LLM einen Schritt
 *  voraus, statt Tokens an einer sicheren Absage zu verschwenden. */
export const BRIDGE_RESEARCH_RISK_MIN_FREQUENCY = 2;

export const DEFAULT_BRIDGE_MODEL = CLAUDE_MODELS.opus;

/** Marker the LLM may emit when no RISK_SIGNAL_TYPES value sensibly fits.
 *  Persisted as-is in bridge_suggestions.source_refs.mappedRiskType; the
 *  UI renders these as "Unklassifiziert" badges. Bewusst NICHT als Teil
 *  des Schema-Enums — die Risk-Klassifikation bleibt fix; der Kandidat
 *  ist ein Watch-Item, das auch ohne saubere Vokabel-Zuordnung valide ist. */
export const UNCLASSIFIED_MARKER = "UNKLASSIFIZIERT";

// ── Output schema for the LLM derivation ───────────────────────────────────

const MappedRiskTypeSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.toUpperCase() : v),
  z.enum([...RISK_SIGNAL_TYPES, UNCLASSIFIED_MARKER] as [string, ...string[]]),
);

const RiskCandidateSchema = z.object({
  /** Same posture as Brücke #1's DerivedGoalSchema.derivable — the LLM is
   *  the single instance allowed to honestly refuse here. Engine does NOT
   *  downgrade to heuristic on derivable=false; that flag travels through
   *  to the suggestion. */
  derivable: z.boolean(),
  /** Short DE name, 8-160 chars, MUST reference the theme. Null when
   *  derivable=false. Form: noun-phrase, not a full sentence. */
  candidateName: z.string().min(8).max(160).nullable(),
  /** One of the 9 RISK_SIGNAL_TYPES (or UNKLASSIFIZIERT) when derivable=true.
   *  Null when derivable=false. */
  mappedRiskType: MappedRiskTypeSchema.nullable(),
  /** 1-2 sentences DE, MUST explicitly reference the theme (lexically
   *  checked by the eval). Null when derivable=false. */
  reasoning: z.string().min(8).max(800).nullable(),
});

export type RiskCandidate = z.infer<typeof RiskCandidateSchema>;

// ── Pure input + public output shape ───────────────────────────────────────

export interface DeriveRiskCandidateInput {
  /** Synthesis emergent_theme title (Outset-style label). */
  themeTitle: string;
  /** 1-3 sentences cross-call summary. */
  themeSummary: string;
  /** Number of distinct respondents carrying this theme. <2 = thin. */
  frequency: number;
  /** Verbatim quotes from underlying Stage-1 evidence. Empty = quote-less
   *  theme (allowed but flagged "vorsichtig" in the prompt). */
  quotes?: string[];
  /** Optional context to disambiguate which study the theme came from
   *  ("Onboarding-Studie Q2 2026"). Carried into the prompt for
   *  human-readable reasoning; never required. */
  studyTitle?: string | null;
}

export interface ResearchRiskSuggestion {
  id: string;
  orgId: string;
  sourceModule: "research";
  sourceRefs: ResearchRiskRefs;
  kind: "research_to_risk";
  status: "pending" | "approved" | "dismissed";
  decidedAt: string | null;
  createdAt: string;
}

/** Persisted into bridge_suggestions.source_refs. Loose contract — the
 *  panel reads fields by name and tolerates missing ones (future scans
 *  may extend the shape). */
export interface ResearchRiskRefs {
  kind: "research_to_risk";
  planId: string;
  planTitle: string | null;
  themeTitle: string;
  themeSummary: string;
  frequency: number;
  /** Optional first-3 quotes from the underlying evidence — for the
   *  panel header to show context without re-fetching the synthesis. */
  quotes: string[];
  /** Filled from the LLM derivation. Null when derivable=false but the
   *  suggestion is still persisted (the user might overwrite manually). */
  candidateName: string | null;
  mappedRiskType: string | null;
  reasoning: string | null;
  derivable: boolean;
}

export class ResearchRiskUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "ResearchRiskUnavailableError";
  }
}

// ── System prompt ──────────────────────────────────────────────────────────

const RISK_TYPE_LABELS: Record<string, string> = {
  CHAMPION_LOSS: "Verlust des internen Champions / Fürsprechers",
  COMPETITOR_PRESSURE: "Druck durch konkurrierende Anbieter",
  STALLING_PATTERN: "Entscheidungsverzögerung / Stalling",
  BUDGET_FRICTION: "Budget-Reibung / Kostendruck",
  CHAMPION_DISENGAGEMENT: "Champion-Disengagement (Rückzug des Fürsprechers)",
  LATE_DECISION_MAKER: "Spät auftauchender Decision-Maker",
  STAKEHOLDER_CHURN: "Wechsel relevanter Stakeholder",
  ENGAGEMENT_DROP: "Engagement-Rückgang / Kommunikationsabbruch",
  MULTI_THREADING_FAILURE: "Fehlende Multi-Threading-Beziehung",
};

function buildVocabBlock(): string {
  const lines = RISK_SIGNAL_TYPES.map(
    (t) => `  - ${t} — ${RISK_TYPE_LABELS[t] ?? t}`,
  );
  lines.push(
    `  - ${UNCLASSIFIED_MARKER} — wähle das, wenn das Thema risiko-relevant ist, aber keiner der obigen 9 Typen sauber passt (z.B. ein produkt-/integrations-spezifisches Muster, das im Sales-Vokabular noch keinen Namen hat).`,
  );
  return lines.join("\n");
}

export const BRIDGE_RESEARCH_RISK_SYSTEM_PROMPT = `Du leitest aus einem RESEARCH-SYNTHESE-THEMA EINEN Risk-Signal-Kandidaten für die Sales-Risk-Bewertung ab — auf DEUTSCH. Der Kandidat wird KEIN Auto-Signal; das Team entscheidet per Klick, ob das Muster in die Watch-Liste aufgenommen wird.

POSTURE — Honest derivation, KEINE Spezifika erfinden.
- Du arbeitest ausschließlich mit dem strukturierten Theme-Input: themeTitle, themeSummary, frequency und optional ein paar verbatim quotes. Wenn ein Detail nicht im Input steht, schreib es NICHT auf. Keine konkreten Konkurrenten-Namen erfinden, keine Preis-Zahlen, keine Personen-Namen.
- Der candidateName + reasoning MÜSSEN den Theme-Kern semantisch referenzieren — verwende Begriffe aus themeTitle oder themeSummary explizit.

VOKABULAR (mappedRiskType — wähle GENAU EINEN):
${buildVocabBlock()}

EHRLICHE ABSAGE (derivable=false, alle drei Felder null):
- Das Thema ist nicht risiko-relevant (z.B. positives Lob, Feature-Wunsch ohne Verhinderungs-Aspekt, reine UX-Beobachtung ohne Kauf-/Bleib-Konsequenz).
- frequency ist unter 2 (extrem dünne Basis — eine Einzelmeinung ist kein Muster).
- Das Thema ist so vage formuliert, dass kein konkretes Sales-Risiko erkennbar ist.

DÜNN ABER NICHT IRRELEVANT (frequency = 2):
- derivable=true erlaubt, aber: candidateName muss erkennbar vorsichtig sein ("erste Hinweise auf …", "explorativ", "Watch-Kandidat …"), und das reasoning muss die kleine Fallzahl namentlich erwähnen ("auf Basis von 2 Respondenten / 2 Interviews / 2 Stimmen").

KLARES MUSTER (frequency >= 3):
- derivable=true, ein präziser deutscher Kandidatname als Substantiv-Phrase (z.B. "Integrations-Tiefe als Kaufkriterium bei ERP-Käufern", "Pricing-Intransparenz blockiert Mid-Market-Entscheidungen"), und 1-2 Sätze reasoning mit Bezug auf den Theme-Inhalt UND auf den gewählten mappedRiskType.

FORM:
- candidateName: 8-160 Zeichen, Deutsch, Nominalphrase (KEINE Frage, KEIN Imperativ, KEIN ganzer Satz mit Verb).
- reasoning: 8-800 Zeichen, Deutsch, 1-2 Sätze. KEINE Bullet-Listen. KEINE Spezifika, die nicht im Input stehen.
- mappedRiskType: aus dem Vokabular oben (case-insensitive akzeptiert, wird upper-case normalisiert).
- KEIN Markdown, KEIN Vorlauf außerhalb des JSON.

OUTPUT — return ONLY this JSON, no markdown, no preamble:

{
  "derivable": <bool>,
  "candidateName": <string|null>,
  "mappedRiskType": <string|null>,
  "reasoning": <string|null>
}`;

// ── User-prompt builder ────────────────────────────────────────────────────

function buildDeriveUserPrompt(input: DeriveRiskCandidateInput): string {
  const lines: string[] = [
    `RESEARCH-SYNTHESE-THEMA`,
    `themeTitle:   ${input.themeTitle.trim()}`,
    `frequency:    ${input.frequency}`,
  ];
  if (input.studyTitle && input.studyTitle.trim() !== "") {
    lines.push(`studyTitle:   ${input.studyTitle.trim()}`);
  }
  lines.push(`themeSummary:`);
  lines.push(input.themeSummary.trim());
  const quotes = (input.quotes ?? []).filter(
    (q) => typeof q === "string" && q.trim() !== "",
  );
  if (quotes.length > 0) {
    lines.push(``, `quotes (verbatim — KEINE Spezifika ausserhalb dieser hinzufügen):`);
    for (const q of quotes.slice(0, 5)) {
      lines.push(`  - "${q.trim()}"`);
    }
  } else {
    lines.push(``, `quotes: (keine — sei besonders vorsichtig mit Spezifika)`);
  }
  lines.push(
    ``,
    `Liefere das Ergebnis als JSON-Objekt — keine Markdown-Blöcke, kein Vorlauf.`,
  );
  return lines.join("\n");
}

// ── Pure derivation entry (eval + production both call this) ──────────────

/**
 * Pure-input entry — no DB. Robust transport: forced tool-use via
 * callClaudeStructured (no text-JSON regex/parse). Used by:
 *   - the eval harness (deterministic property checks on fixed themes)
 *   - detectAndPersistResearchRiskSuggestions below (DB-driven; iterates
 *     over emergent_themes of a plan's study_synthesis)
 * Fail-closed preserved (ResearchRiskUnavailableError).
 */
export async function deriveRiskCandidateFromTheme(
  input: DeriveRiskCandidateInput,
  model: string = process.env.BRIDGE_MODEL ?? DEFAULT_BRIDGE_MODEL,
): Promise<RiskCandidate> {
  // Pre-filter (unchanged): themes below the frequency threshold get an
  // immediate honest refusal without spending tokens. The system prompt
  // encodes the same rule; we just save the round trip.
  if (input.frequency < BRIDGE_RESEARCH_RISK_MIN_FREQUENCY) {
    return {
      derivable: false,
      candidateName: null,
      mappedRiskType: null,
      reasoning: null,
    };
  }

  const userPrompt = buildDeriveUserPrompt(input);

  let data: RiskCandidate;
  try {
    data = await callClaudeStructured({
      schema: RiskCandidateSchema,
      system: BRIDGE_RESEARCH_RISK_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      model,
      maxTokens: 768,
      timeoutMs: 60_000,
      toolName: "emit_risk_candidate",
      toolDescription:
        "Return the sales-risk candidate derived from the research theme — derivable plus candidateName, mappedRiskType and reasoning, or derivable=false with all three null when the theme is not risk-relevant.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      throw new ResearchRiskUnavailableError(
        "Claude research-risk derivation returned invalid output twice",
        err,
      );
    }
    throw new ResearchRiskUnavailableError(
      "Claude research-risk derivation failed",
      err,
    );
  }

  // Defense-in-depth (UNCHANGED): the schema allows "derivable=true && (other
  // fields null)" and vice-versa — both incoherent. Normalize to an honest
  // refusal rather than persisting a contradiction.
  const allOtherNull =
    data.candidateName === null &&
    data.mappedRiskType === null &&
    data.reasoning === null;
  if (data.derivable && allOtherNull) {
    return {
      derivable: false,
      candidateName: null,
      mappedRiskType: null,
      reasoning: null,
    };
  }
  if (!data.derivable && !allOtherNull) {
    return {
      derivable: false,
      candidateName: null,
      mappedRiskType: null,
      reasoning: null,
    };
  }
  return data;
}

// ── DB augmentation (mirror Brücke #1/#2 inline-pattern) ───────────────────

type BridgeStatus = "pending" | "approved" | "dismissed";

type BridgeSuggestionRow = {
  id: string;
  org_id: string;
  source_module: string;
  source_refs: Json;
  kind: string;
  derived_goal: string | null;
  segment: string | null;
  status: BridgeStatus;
  approved_plan_id: string | null;
  decided_at: string | null;
  created_at: string;
};

type BridgeSuggestionInsert = {
  id?: string;
  org_id: string;
  source_module: string;
  source_refs?: Json;
  kind: string;
  derived_goal?: string | null;
  segment?: string | null;
  status?: BridgeStatus;
  approved_plan_id?: string | null;
  decided_at?: string | null;
  created_at?: string;
};

type BridgeSuggestionUpdate = {
  source_module?: string;
  source_refs?: Json;
  kind?: string;
  derived_goal?: string | null;
  segment?: string | null;
  status?: BridgeStatus;
  approved_plan_id?: string | null;
  decided_at?: string | null;
};

// study_synthesis + research_plans read-only slim views.
type StudySynthRow = {
  id: string;
  org_id: string;
  plan_id: string;
  emergent_themes: Json;
  synthesized_at: string | null;
};

type ResearchPlanRow = {
  id: string;
  org_id: string;
  title: string | null;
};

type DatabaseWithBridge = {
  __InternalSupabase: Database["__InternalSupabase"];
  public: {
    Tables: Database["public"]["Tables"] & {
      bridge_suggestions: {
        Row: BridgeSuggestionRow;
        Insert: BridgeSuggestionInsert;
        Update: BridgeSuggestionUpdate;
        Relationships: [];
      };
      study_synthesis: {
        Row: StudySynthRow;
        Insert: StudySynthRow;
        Update: StudySynthRow;
        Relationships: [];
      };
      research_plans: {
        Row: ResearchPlanRow;
        Insert: ResearchPlanRow;
        Update: ResearchPlanRow;
        Relationships: [];
      };
    };
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"];
    Enums: Database["public"]["Enums"];
    CompositeTypes: Database["public"]["CompositeTypes"];
  };
};

function createBridgeSupabase(): SupabaseClient<DatabaseWithBridge> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin operations.",
    );
  }
  return createClient<DatabaseWithBridge>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

// ── Detector → persistence orchestration ───────────────────────────────────

export interface ResearchRiskScanResult {
  /** Themes inspected (after frequency pre-filter). */
  scanned: number;
  /** New pending suggestions persisted. */
  created: number;
  /** Skipped because a pending OR approved suggestion already covers this
   *  (planId, themeTitle). */
  skipped: number;
  /** Themes the LLM honestly refused (derivable=false). Still persisted
   *  so the user sees them, but the panel renders them with a "no-mapping"
   *  badge. Counted separately for transparency. */
  refused: number;
  /** Errors on a single theme (LLM unavailable, insert failure). Logged
   *  and counted; the scan continues. */
  failed: number;
}

function toSuggestion(row: BridgeSuggestionRow): ResearchRiskSuggestion {
  const refs = (row.source_refs ?? {}) as unknown as ResearchRiskRefs;
  return {
    id: row.id,
    orgId: row.org_id,
    sourceModule: "research",
    sourceRefs: refs,
    kind: "research_to_risk",
    status: row.status,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  };
}

interface EmergentThemeRaw {
  title?: unknown;
  summary?: unknown;
  frequency?: unknown;
  sourceInsightIds?: unknown;
  quotes?: unknown;
}

function readThemes(raw: Json | null): Array<{
  title: string;
  summary: string;
  frequency: number;
  quotes: string[];
}> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{
    title: string;
    summary: string;
    frequency: number;
    quotes: string[];
  }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const t = item as EmergentThemeRaw;
    const title = typeof t.title === "string" ? t.title.trim() : null;
    const summary = typeof t.summary === "string" ? t.summary.trim() : null;
    const frequency = typeof t.frequency === "number" ? t.frequency : null;
    if (!title || !summary || !frequency || frequency < 1) continue;
    const quotes = Array.isArray(t.quotes)
      ? t.quotes.filter(
          (q): q is string => typeof q === "string" && q.trim() !== "",
        )
      : [];
    out.push({ title, summary, frequency, quotes });
  }
  return out;
}

/**
 * Scan all study_synthesis rows in an org and persist research-to-risk
 * suggestions for emergent themes above the frequency threshold. De-dup:
 * skip themes already covered by a pending OR approved suggestion (key:
 * planId + normalized themeTitle).
 *
 * Each new theme triggers ONE Opus call. Dismissed suggestions do NOT
 * block re-detection — a fresh synthesis with the same theme title is
 * a legitimate new signal worth re-surfacing.
 */
export async function detectAndPersistResearchRiskSuggestions(
  orgId: string,
  model: string = process.env.BRIDGE_MODEL ?? DEFAULT_BRIDGE_MODEL,
): Promise<ResearchRiskScanResult> {
  const supabase = createBridgeSupabase();

  // 1) all study_synthesis rows + their plan titles for context.
  const { data: syntheses, error: synthErr } = await supabase
    .from("study_synthesis")
    .select("*")
    .eq("org_id", orgId);
  if (synthErr) {
    throw new ResearchRiskUnavailableError(
      `Could not read study_synthesis: ${synthErr.message}`,
    );
  }
  if (!syntheses || syntheses.length === 0) {
    return { scanned: 0, created: 0, skipped: 0, refused: 0, failed: 0 };
  }

  const planIds = Array.from(new Set(syntheses.map((s) => s.plan_id)));
  const { data: plans } = await supabase
    .from("research_plans")
    .select("id, title, org_id")
    .eq("org_id", orgId)
    .in("id", planIds);
  const titleByPlanId = new Map<string, string | null>();
  for (const p of plans ?? []) titleByPlanId.set(p.id, p.title);

  // 2) existing pending/approved suggestions for de-dup.
  const { data: existing, error: exErr } = await supabase
    .from("bridge_suggestions")
    .select("*")
    .eq("org_id", orgId)
    .eq("kind", "research_to_risk")
    .in("status", ["pending", "approved"]);
  if (exErr) {
    throw new ResearchRiskUnavailableError(
      `Could not check existing research-to-risk suggestions: ${exErr.message}`,
    );
  }
  const existingKeys = new Set<string>();
  for (const row of existing ?? []) {
    const refs = row.source_refs as unknown as ResearchRiskRefs | null;
    if (refs?.planId && refs?.themeTitle) {
      existingKeys.add(dedupKey(refs.planId, refs.themeTitle));
    }
  }

  let scanned = 0;
  let created = 0;
  let skipped = 0;
  let refused = 0;
  let failed = 0;

  for (const synth of syntheses) {
    const themes = readThemes(synth.emergent_themes);
    const planTitle = titleByPlanId.get(synth.plan_id) ?? null;

    for (const theme of themes) {
      if (theme.frequency < BRIDGE_RESEARCH_RISK_MIN_FREQUENCY) {
        // Pre-filter: we don't even count these as "scanned" — they're
        // structurally too thin to produce a candidate, regardless of LLM.
        continue;
      }
      const key = dedupKey(synth.plan_id, theme.title);
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }
      scanned++;

      let candidate: RiskCandidate;
      try {
        candidate = await deriveRiskCandidateFromTheme(
          {
            themeTitle: theme.title,
            themeSummary: theme.summary,
            frequency: theme.frequency,
            quotes: theme.quotes,
            studyTitle: planTitle,
          },
          model,
        );
      } catch (err) {
        console.error(
          `[bridge:research-to-risk] derivation failed for plan=${synth.plan_id} theme="${theme.title.slice(0, 60)}":`,
          err instanceof Error ? err.message : err,
        );
        failed++;
        continue;
      }

      const refs: ResearchRiskRefs = {
        kind: "research_to_risk",
        planId: synth.plan_id,
        planTitle,
        themeTitle: theme.title,
        themeSummary: theme.summary,
        frequency: theme.frequency,
        quotes: theme.quotes.slice(0, 3),
        candidateName: candidate.derivable ? candidate.candidateName : null,
        mappedRiskType: candidate.derivable ? candidate.mappedRiskType : null,
        reasoning: candidate.derivable ? candidate.reasoning : null,
        derivable: candidate.derivable,
      };

      const { error: insErr } = await supabase
        .from("bridge_suggestions")
        .insert({
          org_id: orgId,
          source_module: "research",
          source_refs: refs as unknown as Json,
          kind: "research_to_risk",
          derived_goal: null,
          segment: null,
          status: "pending",
        });
      if (insErr) {
        console.error(
          `[bridge:research-to-risk] insert failed for plan=${synth.plan_id} theme="${theme.title.slice(0, 60)}":`,
          insErr.message,
        );
        failed++;
        continue;
      }
      if (candidate.derivable) {
        created++;
      } else {
        refused++;
      }
      existingKeys.add(key); // prevent re-derivation within the same scan
    }
  }

  return { scanned, created, skipped, refused, failed };
}

function dedupKey(planId: string, themeTitle: string): string {
  return `${planId}::${themeTitle.trim().toLowerCase()}`;
}

// ── List + approve + (dismiss reuses kind-agnostic endpoint) ───────────────

/**
 * List pending + approved suggestions for this org. The panel renders BOTH
 * — pending in the "Vorschläge" section, approved as the "Watch-Liste".
 * Dismissed rows are excluded.
 */
export async function listResearchRiskSuggestions(
  orgId: string,
): Promise<ResearchRiskSuggestion[]> {
  const supabase = createBridgeSupabase();
  const { data, error } = await supabase
    .from("bridge_suggestions")
    .select("*")
    .eq("org_id", orgId)
    .eq("kind", "research_to_risk")
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(toSuggestion);
}

/**
 * Approve a pending research_to_risk suggestion. Pure state transition —
 * no side effects (no plan creation, no health-score write, no classifier
 * feedback). The approved row IS the artifact: it appears in the
 * Watch-Liste on the Sales-surface panel.
 *
 * Idempotency: a second approve on the same suggestion returns null
 * (status not pending).
 */
export async function approveResearchRiskSuggestion(
  orgId: string,
  suggestionId: string,
): Promise<ResearchRiskSuggestion | null> {
  const supabase = createBridgeSupabase();
  const { data: row, error: rowErr } = await supabase
    .from("bridge_suggestions")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", suggestionId)
    .maybeSingle();
  if (rowErr || !row) return null;
  if (row.status !== "pending") return null;
  if (row.kind !== "research_to_risk") return null;

  const { data: updated, error: upErr } = await supabase
    .from("bridge_suggestions")
    .update({
      status: "approved",
      decided_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", suggestionId)
    .select("*")
    .maybeSingle();
  if (upErr || !updated) return null;
  return toSuggestion(updated);
}

// dismiss reuses /api/bridge/suggestions/[id]/dismiss (kind-agnostic).

// Re-export the enum so the eval doesn't need a second import.
export { RISK_SIGNAL_TYPES };

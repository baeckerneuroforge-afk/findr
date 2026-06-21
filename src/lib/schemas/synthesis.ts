import { z } from "zod";

/**
 * Study-Synthesis result schema. Stage 2 of the Product-Discovery pipeline:
 * cross-call aggregation over many product_discovery_insights rows of a
 * single research_plan. Reads Stage-1 verdichtungen (feature_requests,
 * pain_points, themes, summary, respondent metadata) and emits emergent
 * themes + tensions + overview — the Outset-style synthesis surface.
 *
 * Mirrors src/lib/schemas/product-discovery.ts conventions: enumerated
 * preprocesses where applicable (none here — all fields are free text),
 * mandatory `sourceInsightIds` to enforce anchoring at the SCHEMA level
 * (the engine layers a second anchored-filter on top to reject themes
 * whose IDs don't appear in the input set OR whose quotes are
 * paraphrased).
 *
 * HARDE REGEL: Emergent themes and tensions MUST cite ≥1 source insight
 * id. The schema enforces .min(1); a theme with zero sources is a
 * hallucination by definition and is rejected pre-persist.
 *
 * NOT enforced in the schema (must be filtered in engine code):
 *  - sourceInsightIds reference IDs that actually exist in the inputs
 *  - quotes appear verbatim in the inputs (after typography fold)
 *  - frequency matches unique(sourceInsightIds).length
 * These are content rules, not shape rules — the schema validates shape
 * only; the engine validates content before upserting study_synthesis.
 */

// ── Emergent theme ──────────────────────────────────────────────────────────

const EmergentThemeSchema = z.object({
  /** Short label, the Outset-style theme header ("Onboarding-Friction
   *  für neue Admin-User", "Dashboard für Finance"). */
  title: z.string().min(3).max(120),
  /** 1-3 sentences summarizing the shared concern. NOT a quote — the
   *  synthesizer's own framing of what the multiple respondents agreed
   *  on, in cross-call language. */
  summary: z.string().min(1).max(600),
  /** Number of distinct respondents (= source_insight_ids) carrying this
   *  theme. The schema accepts any positive int the model returns; the
   *  engine OVERRIDES it post-parse with unique(sourceInsightIds).length
   *  so frequency is always honest about anchoring. */
  frequency: z.number().int().min(1),
  /** product_discovery_insights.source_call_id values OR insight.id
   *  values that carry evidence for this theme. ≥1 is mandatory at the
   *  schema level — the engine rejects themes that don't satisfy
   *  membership in the actual input set (a second anchored-filter,
   *  layered on top). */
  sourceInsightIds: z.array(z.string()).min(1).max(50),
  /** Verbatim customer quotes pulled from the underlying Stage-1
   *  evidence arrays. Empty array is allowed at schema level so a
   *  theme that's grounded in summaries (not quotes) can still pass;
   *  the synthesis eval's quote-coverage check (Tier-2a A4,
   *  src/lib/synthesis/eval-checks.ts → quoteCoverageScan) flags quote-less
   *  themes (and tension sides) as a WARN for human review — a measurement
   *  only, the prod anchored-filter still lets a quote-less theme survive on
   *  its valid ids. */
  quotes: z.array(z.string()).max(8).default([]),
});
export type EmergentTheme = z.infer<typeof EmergentThemeSchema>;

/**
 * Normalize persisted `emergent_themes` JSONB into honest `EmergentTheme[]`.
 *
 * `study_synthesis.emergent_themes` is written as validated JSONB (the engine
 * parses the model result with `StudySynthesisResultSchema` before upsert), so
 * every READ path CASTS the column rather than re-parsing it. Legacy / partial
 * rows — or anything written before a field existed — therefore reach consumers
 * with inner fields `undefined`. Code that iterates a theme's `quotes`
 * (`for (const q of t.quotes)`) then crashes with "undefined is not iterable" /
 * "Cannot read properties of undefined". The outer `?? []` that guards a
 * missing column never reaches the inner fields.
 *
 * Mirrors `normalizeThemes` in product-discovery.ts EXACTLY: a defensive map,
 * NOT `EmergentThemeSchema.parse`. parse would THROW on legacy rows that
 * violate the title/summary length or the `.min(1)` source-id constraint,
 * turning a render glitch into a total read failure. The map never throws,
 * preserves all existing content, and defaults the inner fields — missing
 * arrays → `[]`, missing strings → `""`, missing frequency → `0` — so the
 * result genuinely satisfies `EmergentTheme` with no `as unknown` cast that
 * lies about the shape.
 *
 * Single source for any synthesis read path that reaches a theme's INNER
 * fields (currently highlight-reels.ts, which iterates `quotes`).
 */
export function normalizeEmergentThemes(value: unknown): EmergentTheme[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const theme =
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? (entry as Record<string, unknown>)
        : {};
    const sourceInsightIds = theme.sourceInsightIds;
    const quotes = theme.quotes;
    return {
      title: typeof theme.title === "string" ? theme.title : "",
      summary: typeof theme.summary === "string" ? theme.summary : "",
      frequency: typeof theme.frequency === "number" ? theme.frequency : 0,
      sourceInsightIds: Array.isArray(sourceInsightIds)
        ? (sourceInsightIds as string[])
        : [],
      quotes: Array.isArray(quotes) ? (quotes as string[]) : [],
    };
  });
}

// ── Tension (two-sided disagreement) ────────────────────────────────────────

/** One side of a tension — a coherent position taken by ≥1 respondent.
 *  Both sides of a tension must be anchored to DIFFERENT insight ids; the
 *  engine drops tensions where side_a.sourceInsightIds ∩ side_b.sourceInsightIds
 *  ≠ ∅ (a respondent can't legitimately be on both sides of the same
 *  disagreement). */
const TensionSideSchema = z.object({
  /** Short label naming the position ("wants a native mobile app",
   *  "prefers browser-only", "trusts the auto-tagger", "wants manual
   *  review"). */
  label: z.string().min(3).max(160),
  sourceInsightIds: z.array(z.string()).min(1).max(50),
  quotes: z.array(z.string()).max(8).default([]),
});
export type TensionSide = z.infer<typeof TensionSideSchema>;

const TensionSchema = z.object({
  /** 1-2 sentences naming the disagreement at the conceptual level —
   *  what the two sides are arguing about. */
  description: z.string().min(1).max(500),
  side_a: TensionSideSchema,
  side_b: TensionSideSchema,
});
export type Tension = z.infer<typeof TensionSchema>;

/**
 * Normalize one persisted tension `side` into an honest `TensionSide`.
 *
 * Same defensive contract as `normalizeEmergentThemes`: a missing / garbage
 * side object becomes a fully-formed `TensionSide` with empty inner fields,
 * never `undefined`. Export consumers deref `side.label`,
 * `side.sourceInsightIds.length` and `side.quotes.slice(...)` (PDF + PPTX)
 * with no outer guard, so each inner field must be guaranteed present.
 */
function normalizeTensionSide(value: unknown): TensionSide {
  const side =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const sourceInsightIds = side.sourceInsightIds;
  const quotes = side.quotes;
  return {
    label: typeof side.label === "string" ? side.label : "",
    sourceInsightIds: Array.isArray(sourceInsightIds)
      ? (sourceInsightIds as string[])
      : [],
    quotes: Array.isArray(quotes) ? (quotes as string[]) : [],
  };
}

/**
 * Normalize persisted `tensions` JSONB into honest `Tension[]`.
 *
 * The sibling of `normalizeEmergentThemes` for the second un-normalized
 * `study_synthesis` JSONB column. `getStudySynthesis` previously cast
 * `tensions` as `(... as unknown as Tension[]) ?? []` — the outer `?? []`
 * guards a missing column but never the inner fields, so a legacy / partial /
 * hand-written row reaches the PDF + PPTX exports with `side_a` / `side_b` (or
 * their `label` / `sourceInsightIds` / `quotes`) `undefined`. Code that reads
 * `tension.side_a.quotes.slice(...)` or `side.sourceInsightIds.length` then
 * crashes with "Cannot read properties of undefined".
 *
 * A defensive map, NOT `TensionSchema.parse`: parse would THROW on legacy rows
 * that violate the description / label length or the `.min(1)` source-id
 * constraint, turning a render glitch into a total read failure. The map never
 * throws, preserves all existing content, and guarantees BOTH sides are always
 * fully-formed `TensionSide` objects (missing description → `""`, missing /
 * garbage side → empty side) so the result genuinely satisfies `Tension` with
 * no `as unknown` cast that lies about the shape.
 *
 * Single source for any synthesis read path that reaches a tension's INNER
 * fields (currently the PDF + PPTX synthesis exports, via getStudySynthesis).
 */
export function normalizeTensions(value: unknown): Tension[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const tension =
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? (entry as Record<string, unknown>)
        : {};
    return {
      description:
        typeof tension.description === "string" ? tension.description : "",
      side_a: normalizeTensionSide(tension.side_a),
      side_b: normalizeTensionSide(tension.side_b),
    };
  });
}

// ── E4: Methodik-Abschnitt („Warum wurde was gefragt?") ────────────────────

/** Eine thematische Fragelinie der Studie mit ihrer aggregierten Begründung —
 *  aus den ECHTEN per-Frage-Rationales (E3 WHY-Header), nie post-hoc. */
const MethodologyThemeSchema = z.object({
  topic: z
    .string()
    .min(2)
    .max(160)
    .describe(
      "Short label of one line of questioning (a plan topic or recurring probe focus) — NOT a single question.",
    ),
  rationale: z
    .string()
    .min(1)
    .max(400)
    .describe(
      "1-2 sentences aggregating WHY this line was pursued, grounded ONLY in the supplied QUESTION RATIONALES. Method-focused, never a judgment about participants.",
    ),
});

export const MethodologySchema = z.object({
  summary: z
    .string()
    .min(1)
    .max(800)
    .describe(
      "2-3 sentences for the researcher: how the interviewer steered this study overall, based ONLY on the supplied rationales.",
    ),
  themes: z.array(MethodologyThemeSchema).max(8).default([]),
  coverageNote: z
    .string()
    .max(300)
    .nullable()
    .default(null)
    .describe(
      "Honest coverage statement when rationales are missing for some sessions (e.g. 'Begründungen lagen für 4 von 9 Interviews vor'). Null when all sessions carried rationales.",
    ),
});
export type Methodology = z.infer<typeof MethodologySchema>;

/** Lenienter Read-Mapper (Stil normalizeEmergentThemes): persistierte
 *  methodology-JSONB → Methodology | null, niemals werfen. */
export function normalizeMethodology(value: unknown): Methodology | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const m = value as Record<string, unknown>;
  if (typeof m.summary !== "string" || m.summary.trim() === "") return null;
  const themes = Array.isArray(m.themes)
    ? m.themes.flatMap((t) => {
        if (!t || typeof t !== "object" || Array.isArray(t)) return [];
        const theme = t as Record<string, unknown>;
        if (typeof theme.topic !== "string" || typeof theme.rationale !== "string")
          return [];
        return [{ topic: theme.topic, rationale: theme.rationale }];
      })
    : [];
  return {
    summary: m.summary,
    themes,
    coverageNote: typeof m.coverageNote === "string" ? m.coverageNote : null,
  };
}

// ── E7: Stimulus-Sektionen (Multi-Stimulus-Auswertung) ─────────────────────

/** Eine per-Stimulus-Sektion — formuliert AUSSCHLIESSLICH aus den im Prompt
 *  gelieferten Erstreaktions-Ausschnitten des jeweiligen Stimulus; nur für
 *  Positionen über Mindest-N (Engine-Filter erzwingt beides). */
const StimulusSectionSchema = z.object({
  position: z
    .number()
    .int()
    .min(1)
    .describe(
      "1-based stimulus position — MUST be one of the eligible positions listed in the STIMULUS SET block.",
    ),
  summary: z
    .string()
    .min(1)
    .max(600)
    .describe(
      "1-3 sentences on how participants received THIS stimulus, grounded ONLY in its supplied excerpts.",
    ),
  quotes: z.array(z.string()).max(5).default([]),
});
export type StimulusSection = z.infer<typeof StimulusSectionSchema>;

/** Lenienter Read-Mapper (Stil normalizeEmergentThemes): persistierte
 *  stimulus_sections-JSONB → StimulusSection[], niemals werfen. */
export function normalizeStimulusSections(value: unknown): StimulusSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const section = entry as Record<string, unknown>;
    if (
      typeof section.position !== "number" ||
      typeof section.summary !== "string" ||
      section.summary.trim() === ""
    ) {
      return [];
    }
    const quotes = section.quotes;
    return [
      {
        position: section.position,
        summary: section.summary,
        quotes: Array.isArray(quotes)
          ? (quotes as unknown[]).filter(
              (q): q is string => typeof q === "string",
            )
          : [],
      },
    ];
  });
}

// ── Top-level synthesis result ──────────────────────────────────────────────

export const StudySynthesisResultSchema = z.object({
  /** 2-4 sentences, the synthesis "above the fold". What did this study
   *  surface across all respondents? In cross-call language; not a list,
   *  a paragraph. */
  overview: z.string().min(1).max(2000),
  /** Themes the synthesizer judged emergent (≥2 respondents carrying
   *  related signal). Empty array is a VALID answer when the input set
   *  is too sparse / too inconsistent to find shared signal — the
   *  synthesizer must NOT manufacture themes to fill space. */
  emergent_themes: z.array(EmergentThemeSchema).max(12).default([]),
  /** Tensions = real disagreements between two distinct groups. Empty
   *  is again VALID — full consensus produces zero tensions, that is
   *  the correct answer. NEVER manufacture a counter-side to balance
   *  a theme; if every respondent agrees, tensions stays empty. */
  tensions: z.array(TensionSchema).max(6).default([]),
  /** E4 — „Warum wurde was gefragt?" aus den echten WHY-Rationales (E3).
   *  NULL ist der Pflicht-Default, wenn der User-Prompt keinen
   *  QUESTION-RATIONALES-Block trägt; die Engine erzwingt das zusätzlich
   *  server-seitig (sealSynthesisExtras) — kein Halluzinations-Fenster. */
  methodology: MethodologySchema.nullable().default(null),
  /** E4 — max. 3 Signal-Beobachtungen, formuliert AUSSCHLIESSLICH aus dem
   *  server-berechneten TURN-SIGNALS-Faktenblock (Zahlen wörtlich; Hinweis-
   *  Sprache, nie Personen-Urteile). Leer, wenn kein Block geliefert wurde —
   *  auch das erzwingt die Engine server-seitig. */
  signal_observations: z
    .array(
      z
        .string()
        .min(1)
        .max(400)
        .describe(
          "One observation grounded in the supplied TURN SIGNALS facts, e.g. 'Bei Preisfragen wichen 4 von 12 Antworten aus.' Copy counts verbatim from the facts; phrase as a text-derived hint, never a judgment about persons.",
        ),
    )
    .max(3)
    .default([]),
  /** E7 — eine Sektion je ELIGIBLE Stimulus (Mindest-N erfüllt), formuliert
   *  nur aus den gelieferten Erstreaktions-Ausschnitten. Leer, wenn der
   *  Prompt keinen STIMULUS-SET-Block trug — die Engine erzwingt das
   *  zusätzlich server-seitig (sealSynthesisExtras). */
  stimulus_sections: z.array(StimulusSectionSchema).max(10).default([]),
  /** E7 — 2-4 Sätze Vergleich über die Stimuli hinweg, gegründet in den
   *  Ausschnitten + den SERVER-gezählten Präferenz-Stimmen (Zahlen wörtlich
   *  übernehmen). Null ohne Stimulus-Block / ohne Präferenz-Zahlen. */
  stimulus_comparison: z.string().max(800).nullable().default(null),
});

export type StudySynthesisResult = z.infer<typeof StudySynthesisResultSchema>;

// ── Personas (Audience Segments) ───────────────────────────────────────────
//
// Persona-Feature (Spec docs/klymeo-personas-feature-spec-2026-06-21.md):
// eine ADDITIVE, zweite LLM-Stufe ÜBER derselben Stage-2-Eingabe. Sie clustert
// die Befragten in 3-5 Segmente. Genau wie bei der Synthese gilt: das Schema
// validiert nur die FORM; den INHALT (ID-Mitgliedschaft, Zitat-Verankerung pro
// Insight, ehrliche Größe = unique(sourceInsightIds).length) erzwingt die Engine
// (src/lib/synthesis/audience-personas.ts) in einem zweiten Anker-Filter — das
// frequency-Override-Muster der EmergentTheme, hier auf shareCount übertragen.
//
// NAMING: bewusst `AudiencePersona*`, NICHT `Persona`, um die Doppelbelegung mit
// research_plans.persona (Freitext-Zielgruppe) und src/lib/synthetic/personas.ts
// (synthetische TEST-Charakterbögen) zu vermeiden.

/** Belegbare Trait-Felder einer Persona. Jede `PersonaEvidence` hängt an genau
 *  einem davon — der Anker-Filter unterdrückt ein Trait-Feld, das keine
 *  verankerte Evidence trägt (Spec §5.2: „pro Feld hart belegt"). */
export const PERSONA_EVIDENCE_FIELDS = [
  "goal",
  "pain",
  "behavior",
  "motivation",
  "lead_quote",
] as const;
export type PersonaEvidenceField = (typeof PERSONA_EVIDENCE_FIELDS)[number];

/** Ein verbatim Beleg für ein Trait-Feld: das Zitat MUSS (nach Typo-Fold) in
 *  mindestens einem der zitierten Insights wörtlich vorkommen — die Engine
 *  prüft das PER INSIGHT (nicht global), genau wie bei den Theme-Zitaten, und
 *  blockt so Cross-Respondent-Attribution. */
const PersonaEvidenceSchema = z.object({
  field: z.enum(PERSONA_EVIDENCE_FIELDS),
  /** Verbatim aus den Stage-1-Evidenzen (feature_request.evidence /
   *  pain_point.evidence / theme.summary / summary). Nicht paraphrasieren. */
  text: z.string().min(1).max(400),
  sourceInsightIds: z.array(z.string()).min(1).max(50),
});
export type PersonaEvidence = z.infer<typeof PersonaEvidenceSchema>;

/** EIN Persona-Segment, wie es das LLM emittiert. `shareCount` ist NUR ein
 *  Modell-Hinweis — die Engine überschreibt ihn hart mit
 *  unique(sourceInsightIds).length (kein Schönen möglich), exakt wie
 *  EmergentTheme.frequency. `sourceInsightIds` ist die Cluster-Mitgliedschaft
 *  (.min(2): keine Persona aus einer einzigen Stimme — Spec §5.2/§5.5; die
 *  Engine verwirft zusätzlich Personas mit < 2 verankerten Zitaten). */
const AudiencePersonaSchema = z.object({
  /** Sprechender Segmentname auf Deutsch („Effizienz-getriebene Power-User"). */
  name: z.string().min(2).max(80),
  /** Modell-Hinweis auf die Größe; wird server-seitig überschrieben. */
  shareCount: z.number().int().min(1),
  goals: z.array(z.string().min(1).max(300)).min(1).max(6),
  pains: z.array(z.string().min(1).max(300)).min(1).max(6),
  behavior: z.array(z.string().min(1).max(300)).min(1).max(6),
  motivation: z.string().min(1).max(600),
  /** Ein prägnantes verbatim Zitat als Aushängeschild; wird wie alle Zitate
   *  verankert (sonst von der Engine geleert). */
  leadQuote: z.string().min(1).max(400),
  sourceInsightIds: z.array(z.string()).min(2).max(200),
  evidence: z.array(PersonaEvidenceSchema).min(1).max(40),
});
export type AudiencePersona = z.infer<typeof AudiencePersonaSchema>;

/** Top-level LLM-Ausgabe der Persona-Stufe. Leeres `personas`-Array ist eine
 *  GÜLTIGE Antwort, wenn die Daten keine tragfähigen Segmente hergeben — das
 *  LLM darf KEINE Personas erfinden, um den Bereich 3-5 zu füllen. Max. 5
 *  (Spec: dynamisch 3-5). */
export const AudiencePersonasResultSchema = z.object({
  personas: z.array(AudiencePersonaSchema).max(5).default([]),
});
export type AudiencePersonasResult = z.infer<typeof AudiencePersonasResultSchema>;

// ── Angereicherte (persistierte) Persona-Form ──────────────────────────────
//
// Was in study_synthesis.personas LANDET, ist die vom LLM gelieferte Persona
// PLUS server-berechnete, NICHT vom Modell formulierte Felder (Spec §5.3/§5.4):
//   • shareCount  — hart überschrieben = unique(sourceInsightIds).length
//   • sharePercent — round(shareCount / totalInsights * 100)
//   • roleLabel / segmentLabel — Modus von respondent_role / _segment im Cluster
//   • sentimentDistribution — Zählung der echten Insight-Sentiments im Cluster
// Diese Felder kommen NIE aus dem LLM → kein Halluzinations-Fenster.

export interface PersonaSentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
  mixed: number;
  /** Befragte ohne klassifiziertes Sentiment (respondent.sentiment === null). */
  unknown: number;
}

export interface EnrichedAudiencePersona extends AudiencePersona {
  /** Server-erzwungen = unique(sourceInsightIds).length. */
  shareCount: number;
  /** Server-berechnet gegen den Live-Insight-Count zum Erzeugungszeitpunkt. */
  sharePercent: number;
  roleLabel: string | null;
  segmentLabel: string | null;
  sentimentDistribution: PersonaSentimentDistribution;
}

/** Server-Kennzahlen der Persona-Stufe (Muster SignalsSummary): ehrliche
 *  Coverage statt geschönter 100 %-Optik. `qualityHint` = true zwischen
 *  Mindest-Gate und Empfehlungsschwelle (Spec §5.6). */
export interface PersonasSummary {
  version: 1;
  /** Insight-Count zum Erzeugungszeitpunkt (Live, NICHT based_on_count). */
  totalInsights: number;
  /** Σ shareCount über alle ausgegebenen Personas. */
  assigned: number;
  /** totalInsights − assigned (ehrlich ausgewiesen, keine Rest-Karte). */
  unassigned: number;
  qualityHint: boolean;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function normalizeSentimentDistribution(
  value: unknown,
): PersonaSentimentDistribution {
  const d =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const n = (x: unknown): number => (typeof x === "number" ? x : 0);
  return {
    positive: n(d.positive),
    neutral: n(d.neutral),
    negative: n(d.negative),
    mixed: n(d.mixed),
    unknown: n(d.unknown),
  };
}

function normalizePersonaEvidence(value: unknown): PersonaEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const e = entry as Record<string, unknown>;
    const field = PERSONA_EVIDENCE_FIELDS.includes(
      e.field as PersonaEvidenceField,
    )
      ? (e.field as PersonaEvidenceField)
      : null;
    if (field === null || typeof e.text !== "string" || e.text === "") return [];
    return [
      {
        field,
        text: e.text,
        sourceInsightIds: asStringArray(e.sourceInsightIds),
      },
    ];
  });
}

/**
 * Lenienter Read-Mapper (Stil normalizeEmergentThemes): persistierte
 * `personas`-JSONB → EnrichedAudiencePersona[], niemals werfen. Legacy-Zeilen
 * ohne die Spalte erreichen Leser als `undefined` → []; Teil-Objekte werden
 * defensiv mit leeren Innenfeldern aufgefüllt, damit UI/PDF nie an einem
 * fehlenden `goals`/`evidence` crashen. KEIN `.parse` — das würde an
 * Längen-/min-Constraints werfen und einen Render-Glitch zum Totalausfall machen.
 */
export function normalizePersonas(value: unknown): EnrichedAudiencePersona[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const p =
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? (entry as Record<string, unknown>)
        : {};
    return {
      name: typeof p.name === "string" ? p.name : "",
      shareCount: typeof p.shareCount === "number" ? p.shareCount : 0,
      sharePercent: typeof p.sharePercent === "number" ? p.sharePercent : 0,
      goals: asStringArray(p.goals),
      pains: asStringArray(p.pains),
      behavior: asStringArray(p.behavior),
      motivation: typeof p.motivation === "string" ? p.motivation : "",
      leadQuote: typeof p.leadQuote === "string" ? p.leadQuote : "",
      sourceInsightIds: asStringArray(p.sourceInsightIds),
      evidence: normalizePersonaEvidence(p.evidence),
      roleLabel: typeof p.roleLabel === "string" ? p.roleLabel : null,
      segmentLabel: typeof p.segmentLabel === "string" ? p.segmentLabel : null,
      sentimentDistribution: normalizeSentimentDistribution(
        p.sentimentDistribution,
      ),
    };
  });
}

/** Lenienter Read-Mapper für `personas_summary`-JSONB → PersonasSummary | null. */
export function normalizePersonasSummary(value: unknown): PersonasSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const s = value as Record<string, unknown>;
  const n = (x: unknown): number => (typeof x === "number" ? x : 0);
  return {
    version: 1,
    totalInsights: n(s.totalInsights),
    assigned: n(s.assigned),
    unassigned: n(s.unassigned),
    qualityHint: s.qualityHint === true,
  };
}

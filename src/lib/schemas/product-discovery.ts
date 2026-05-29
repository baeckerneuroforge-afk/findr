import { z } from "zod";

/**
 * Product Discovery classifier schema. Phase 3 of the AI brain: same pattern
 * as Risk (pre-sale) and Health (post-sale), but pointed inward at the
 * vendor's OWN product — what customers ask for, what hurts, recurring
 * themes. Runs on BOTH pre-sale (deal_id) and post-sale (account_id) calls.
 *
 * Structural cousin of schemas/health.ts: enumerated categories with
 * case-insensitive preprocess (LLMs occasionally return enum values in the
 * wrong case — "new_capability" vs "NEW_CAPABILITY"; we normalize STRINGS
 * before the enum check WITHOUT changing the allowed value set). Non-strings
 * fall through so the enum still rejects them clearly.
 *
 * Unlike Risk / Health, there is NO score and NO aggregator — Phase 3 is
 * pure per-call extraction; cross-call rollups land in Phase 3.2 as plain
 * SQL over the JSONB arrays.
 */

const toLowerString = (v: unknown) =>
  typeof v === "string" ? v.toLowerCase() : v;
const toUpperString = (v: unknown) =>
  typeof v === "string" ? v.toUpperCase() : v;

// ── Categories ─────────────────────────────────────────────────────────────

/** Generic starting vocabulary. Verfeinerung an echten Transkripten in den
 *  ersten Eval-Runden — wie das Health-Vokabular über 5 Runden kalibriert
 *  wurde. */
export const FEATURE_REQUEST_CATEGORIES = [
  "NEW_CAPABILITY",
  "ENHANCEMENT",
  "INTEGRATION",
  "UI_UX",
  "AUTOMATION",
  "REPORTING",
  "PERFORMANCE",
  "MOBILE",
  "API",
] as const;
export type FeatureRequestCategory =
  (typeof FEATURE_REQUEST_CATEGORIES)[number];

export const PAIN_POINT_CATEGORIES = [
  "BUG",
  "MISSING_FEATURE",
  "UX_FRICTION",
  "PERFORMANCE_ISSUE",
  "RELIABILITY",
  "ONBOARDING",
  "DATA_QUALITY",
  "INTEGRATION_GAP",
  "SUPPORT",
] as const;
export type PainPointCategory = (typeof PAIN_POINT_CATEGORIES)[number];

// ── Intensity / Severity ───────────────────────────────────────────────────

/** Four-step scale, reused for feature-request urgency (intensity) and
 *  pain-point severity. "blocker" means the same on both sides: the customer
 *  explicitly ties this to a stop condition — without X, no contract / no
 *  renewal / no further rollout. */
export const INTENSITY_LEVELS = ["low", "medium", "high", "blocker"] as const;
export type IntensityLevel = (typeof INTENSITY_LEVELS)[number];

// ── Sentiment ──────────────────────────────────────────────────────────────

/** Tonalität des respondent ÜBER das Produkt, vom Classifier aus dem
 *  Transkript abgeleitet. Spiegelt die Spalte product_discovery_insights.
 *  sentiment (CHECK aus Migration 20260616). */
export const SENTIMENT_VALUES = [
  "positive",
  "neutral",
  "negative",
  "mixed",
] as const;
export type Sentiment = (typeof SENTIMENT_VALUES)[number];

// ── Item schemas ───────────────────────────────────────────────────────────

const FeatureRequestSchema = z.object({
  category: z.preprocess(toUpperString, z.enum(FEATURE_REQUEST_CATEGORIES)),
  /** KI-formulierte Kurzform of the request (3–120 chars). */
  title: z.string().min(3).max(120),
  description: z.string().min(1).max(2000),
  intensity: z.preprocess(toLowerString, z.enum(INTENSITY_LEVELS)),
  /** 0 = barely mentioned, 1 = explicit and repeated. The classifier is told
   *  to DROP items with confidence < 0.3 rather than emit them. */
  confidence: z.number().min(0).max(1),
  /** Verbatim quotes from the transcript ONLY — never paraphrase. The prompt
   *  requires ≥1 entry; the schema keeps the array allowed to be empty so a
   *  downstream filter (Phase 3.2 service layer) can decide whether to drop
   *  or surface borderline items, mirroring the Risk classifier's
   *  post-validation filter on confidence + quotes. */
  evidence: z.array(z.string()).max(5).default([]),
});
export type FeatureRequest = z.infer<typeof FeatureRequestSchema>;

const PainPointSchema = z.object({
  category: z.preprocess(toUpperString, z.enum(PAIN_POINT_CATEGORIES)),
  title: z.string().min(3).max(120),
  description: z.string().min(1).max(2000),
  severity: z.preprocess(toLowerString, z.enum(INTENSITY_LEVELS)),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).max(5).default([]),
});
export type PainPoint = z.infer<typeof PainPointSchema>;

// ── Theme ──────────────────────────────────────────────────────────────────

/** A theme is a CLUSTERING over already-extracted items — it references at
 *  least one featureRequest OR painPoint by its array index. Themes never
 *  introduce new content; if items don't cluster naturally, the array stays
 *  empty. */
const ThemeSchema = z.object({
  label: z.string().min(3).max(80),
  summary: z.string().min(1).max(500),
  relatedFeatureRequestIndices: z
    .array(z.number().int().nonnegative())
    .default([]),
  relatedPainPointIndices: z
    .array(z.number().int().nonnegative())
    .default([]),
});
export type Theme = z.infer<typeof ThemeSchema>;

/**
 * Normalize persisted `themes` JSONB into honest `Theme[]` values.
 *
 * Every read path that surfaces product-discovery insights CASTS the JSONB
 * rather than re-parsing it (the classifier validated it on WRITE via
 * `ProductDiscoveryResultSchema.safeParse`). Legacy/partial rows written
 * before `relatedFeatureRequestIndices` / `relatedPainPointIndices` existed
 * therefore reach consumers with those inner array fields `undefined` — and
 * any code doing `theme.relatedFeatureRequestIndices.length` crashes. The
 * outer `?? []` that guards a missing `themes` column never reaches the
 * inner fields.
 *
 * We default the inner fields with an explicit map rather than
 * `ThemeSchema.parse`: parse would THROW on legacy rows that violate the
 * label/summary length constraints, turning a localized render bug into a
 * total read failure for the whole insight list. The map never throws and
 * preserves all existing content; missing array fields fall back to `[]`,
 * missing strings to `""`. The result genuinely satisfies `Theme`, so no
 * `as unknown` cast that lies about the shape.
 *
 * Single source for the product-discovery service read (`toRecord`) and the
 * research/synthesis read paths (chat-with-data, highlight-reels, synthesis
 * engine) — all previously cast `r.themes` and so carried the same latent
 * crash.
 */
export function normalizeThemes(value: unknown): Theme[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const theme =
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? (entry as Record<string, unknown>)
        : {};
    const featureIndices = theme.relatedFeatureRequestIndices;
    const painIndices = theme.relatedPainPointIndices;
    return {
      label: typeof theme.label === "string" ? theme.label : "",
      summary: typeof theme.summary === "string" ? theme.summary : "",
      relatedFeatureRequestIndices: Array.isArray(featureIndices)
        ? (featureIndices as number[])
        : [],
      relatedPainPointIndices: Array.isArray(painIndices)
        ? (painIndices as number[])
        : [],
    };
  });
}

// ── Top-level result ───────────────────────────────────────────────────────

export const ProductDiscoveryResultSchema = z.object({
  featureRequests: z.array(FeatureRequestSchema).max(15).default([]),
  painPoints: z.array(PainPointSchema).max(15).default([]),
  themes: z.array(ThemeSchema).max(8).default([]),
  summary: z.string().min(1).max(3000),
  /** Respondent role — wie sich der Sprecher im Gespräch positioniert
   *  ("Founder eines B2B-SaaS", "Head of Operations", "Werkstudent in
   *  einer Agentur"). Vom Classifier aus dem Transkript extrahiert.
   *  NULL wenn das Transkript keine Aussage darüber macht (z.B. reine
   *  Feature-Discussion ohne Selbstauskunft); der Classifier soll nicht
   *  erraten. Persistiert in product_discovery_insights.respondent_role. */
  respondentRole: z.string().min(1).max(120).nullable().default(null),
  /** Respondent segment — Branche / Reifegrad / Setup, soweit das
   *  Transkript es hergibt ("B2B SaaS, 50-200 employees", "Beratung im
   *  Mittelstand", "Solo-Founder, post-PMF"). Freitext, vom Classifier
   *  aus dem Transkript abgeleitet. NULL wenn unklar — gleiche Posture
   *  wie respondentRole. */
  respondentSegment: z.string().min(1).max(120).nullable().default(null),
  /** Tonalität des respondent zum PRODUKT, nicht zum Gespräch insgesamt.
   *  Default neutral, falls Opus die Stelle elidiert (gleiche Behandlung
   *  wie source). */
  sentiment: z
    .preprocess(toLowerString, z.enum(SENTIMENT_VALUES))
    .default("neutral"),
  /** Single source for this etappe; richer sources (multi-call rollups,
   *  in-app feedback, support tickets) can be added later as a
   *  discriminated union — same evolution path as schemas/health.ts.
   *  Default-injected, same reason as the matching field on
   *  HealthAnalysisResultSchema: Opus occasionally elides this redundant
   *  literal on lighter content, which used to throw schema-validation
   *  before the default catch. Behaviour-neutral. */
  source: z.literal("transcript").default("transcript"),
});

export type ProductDiscoveryResult = z.infer<
  typeof ProductDiscoveryResultSchema
>;

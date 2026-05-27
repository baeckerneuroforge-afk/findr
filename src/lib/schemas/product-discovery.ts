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

// ── Top-level result ───────────────────────────────────────────────────────

export const ProductDiscoveryResultSchema = z.object({
  featureRequests: z.array(FeatureRequestSchema).max(15).default([]),
  painPoints: z.array(PainPointSchema).max(15).default([]),
  themes: z.array(ThemeSchema).max(8).default([]),
  summary: z.string().min(1).max(3000),
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

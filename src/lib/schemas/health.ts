import { z } from "zod";
import { RISK_SIGNAL_TYPES } from "@/lib/schemas/risk";

/**
 * CS Health classifier schema. Distinct from the Risk schema: Health measures
 * satisfaction + relationship strength, NOT just the absence of risk. A quiet,
 * content customer is HEALTHY. A noisy churn-risk customer is UNHEALTHY. These
 * are related but separate judgments, hence a dedicated schema instead of the
 * legacy `health = 100 − risk` inversion (see src/lib/accounts/health-service.ts).
 *
 * Mirrors the case-insensitive preprocess härtung from schemas/risk.ts: LLMs
 * occasionally return enum values in the wrong case ("CRITICAL" vs "critical",
 * lowercase signal types); we normalize STRINGS before the enum check WITHOUT
 * changing the allowed value set. Non-strings fall through so the enum still
 * rejects them clearly.
 */

const toLowerString = (v: unknown) =>
  typeof v === "string" ? v.toLowerCase() : v;
const toUpperString = (v: unknown) =>
  typeof v === "string" ? v.toUpperCase() : v;

// ── Levels ──────────────────────────────────────────────────────────────────

/** Five health levels, finer-grained than the legacy 3-level union (the old
 *  inversion only knew healthy / at_risk / critical). */
export const HEALTH_LEVELS = [
  "thriving",
  "healthy",
  "lukewarm",
  "at_risk",
  "critical",
] as const;
export type HealthLevel = (typeof HEALTH_LEVELS)[number];

// ── Satisfaction axes ───────────────────────────────────────────────────────

/** The four satisfaction axes the classifier rates independently. Keep this
 *  list and the schema below in lockstep — the aggregator iterates over these
 *  keys. */
export const HEALTH_AXIS_KEYS = [
  "product",
  "relationship",
  "valueRealization",
  "engagement",
] as const;
export type HealthAxisKey = (typeof HEALTH_AXIS_KEYS)[number];

const HealthAxisSchema = z.object({
  /** 0 = unhappy / unhealthy on this axis, 100 = great. */
  score: z.number().int().min(0).max(100),
  /** 0 = transcript barely touched this axis (then keep score neutral ~50),
   *  1 = clear, direct evidence in the transcript. */
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1).max(2000),
  /** Verbatim quotes from the transcript ONLY. Never paraphrase. */
  evidence: z.array(z.string()).max(10).default([]),
});
export type HealthAxis = z.infer<typeof HealthAxisSchema>;

// ── Acute signals (reuse Risk vocabulary) ───────────────────────────────────

/** Per-signal severity for the aggregator's penalty + cap logic. */
export const ACUTE_SIGNAL_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type AcuteSignalSeverity = (typeof ACUTE_SIGNAL_SEVERITIES)[number];

const AcuteSignalSchema = z.object({
  /** Same vocabulary as the Risk classifier — reuse, do not invent new types. */
  type: z.preprocess(toUpperString, z.enum(RISK_SIGNAL_TYPES)),
  severity: z.preprocess(toLowerString, z.enum(ACUTE_SIGNAL_SEVERITIES)),
  reasoning: z.string().min(1).max(2000),
  evidence: z.array(z.string()).max(10).default([]),
});
export type AcuteSignal = z.infer<typeof AcuteSignalSchema>;

// ── Top-level result ────────────────────────────────────────────────────────

export const HealthAnalysisResultSchema = z.object({
  /** The classifier's own honest assessment. The aggregator (src/lib/health/
   *  aggregate.ts) RECOMPUTES this deterministically from axes + signals using
   *  fixed weights, so callers should typically use the aggregated value. */
  healthScore: z.number().int().min(0).max(100),
  healthLevel: z.preprocess(toLowerString, z.enum(HEALTH_LEVELS)),
  satisfactionAxes: z.object({
    product: HealthAxisSchema,
    relationship: HealthAxisSchema,
    valueRealization: HealthAxisSchema,
    engagement: HealthAxisSchema,
  }),
  acuteSignals: z.array(AcuteSignalSchema).max(10).default([]),
  summary: z.string().min(1).max(5000),
  /** Single source for this etappe; richer sources (multi-call, CRM, telemetry)
   *  can be added later as a discriminated union. */
  source: z.literal("transcript"),
});

export type HealthAnalysisResult = z.infer<typeof HealthAnalysisResultSchema>;

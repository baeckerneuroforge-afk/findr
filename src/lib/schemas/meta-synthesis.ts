import { z } from "zod";

import {
  MissionControlCitationSchema,
  type MissionControlCitation,
} from "./mission-control";

/** A meta-synthesis citation is the SAME `{ studyId, quote }` contract the
 *  Cross-Study surfaces use — re-exported under a domain name so consumers don't
 *  reach into the mission-control schema. */
export type MetaSynthesisCitation = MissionControlCitation;

/**
 * Meta-Synthesis schema — a "synthesis of syntheses". Where a single
 * study_synthesis (src/lib/schemas/synthesis.ts) aggregates the insights of ONE
 * study, a meta-synthesis aggregates the finished SYNTHESES of MANY studies into
 * one comparative artifact. It is the deep, exportable sibling of the
 * Cross-Study-Agent CHAT — same cross-study anchor discipline, but a structured,
 * high-quality read-out instead of a one-line answer.
 *
 * THE ANCHORING UNIT IS THE STUDY. Every claim carries citations
 * `{ studyId, quote }` — the SAME contract Mission-Control / the Cross-Study-Agent
 * use (MissionControlCitationSchema) — so the engine reuses
 * buildMissionControlAnchorSet + fold verbatim: a quote survives only if it is a
 * verbatim substring of the CITED study's own synthesis text (never the union).
 *
 * As with study_synthesis, the schema validates SHAPE only. The CONTENT rules
 * (studyId membership, quote-verbatim-in-cited-study, "convergent" = ≥2 distinct
 * studies, study_frequency = unique(cited studyIds).length) are enforced in the
 * engine's applyMetaSynthesisAnchorFilter AFTER parse — a mis-attributed citation
 * is dropped, an element that loses its evidence is dropped, exactly like the
 * single-synthesis anchored-filter drops a mis-attributed theme.
 */

// ── Convergent theme (a finding shared ACROSS ≥2 studies) ────────────────────

export const MetaSynthesisConvergentThemeSchema = z.object({
  /** Short cross-study label ("Onboarding-Friction über alle Studien"). */
  title: z.string().min(3).max(120),
  /** 1-3 sentences in cross-study language — the synthesizer's own framing of
   *  what MULTIPLE studies independently surfaced. NOT a quote. */
  summary: z.string().min(1).max(800),
  /** Number of DISTINCT studies carrying this theme. The schema accepts any
   *  positive int the model returns; the engine OVERRIDES it post-parse with
   *  unique(cited studyIds).length so it is always honest about anchoring. */
  study_frequency: z.number().int().min(1),
  /** Verbatim citations, one (or more) per contributing study. ≥1 at the schema
   *  level; the engine additionally requires the SURVIVING citations to span ≥2
   *  distinct studies — a theme that only anchors in one study is not
   *  "convergent" and is dropped (or belongs in study_contributions). */
  citations: z.array(MissionControlCitationSchema).min(1).max(24),
});
export type MetaSynthesisConvergentTheme = z.infer<
  typeof MetaSynthesisConvergentThemeSchema
>;

// ── Divergence (studies genuinely disagree) ──────────────────────────────────

/** One position within a divergence — a stance taken by ≥1 study. */
export const MetaSynthesisPositionSchema = z.object({
  /** Short label naming the stance ("will Automatisierung", "will manuelle
   *  Kontrolle"). */
  label: z.string().min(3).max(160),
  /** The studies that take this position. The engine OVERRIDES this with the
   *  unique studyIds of the SURVIVING citations, so it can never claim a study
   *  the evidence doesn't support. */
  studyIds: z.array(z.string()).min(1).max(50),
  citations: z.array(MissionControlCitationSchema).min(1).max(16),
});
export type MetaSynthesisPosition = z.infer<typeof MetaSynthesisPositionSchema>;

export const MetaSynthesisDivergenceSchema = z.object({
  /** 1-2 sentences naming what the studies disagree about at the conceptual
   *  level. */
  description: z.string().min(1).max(600),
  /** ≥2 positions. The engine drops positions that lose all citations and drops
   *  the whole divergence if fewer than 2 positions — spanning ≥2 distinct
   *  studies — survive (a "divergence" inside one study is a single-study
   *  tension, not a cross-study one). */
  positions: z.array(MetaSynthesisPositionSchema).min(2).max(4),
});
export type MetaSynthesisDivergence = z.infer<
  typeof MetaSynthesisDivergenceSchema
>;

// ── Study contribution (what ONE study uniquely surfaced) ────────────────────

export const MetaSynthesisContributionSchema = z.object({
  /** The single study this contribution belongs to — all its citations must
   *  cite THIS studyId (the engine drops any that don't). */
  studyId: z.string().min(1).max(200),
  /** 1-2 sentences: the finding this study surfaced that the others did not. */
  summary: z.string().min(1).max(600),
  citations: z.array(MissionControlCitationSchema).min(1).max(12),
});
export type MetaSynthesisContribution = z.infer<
  typeof MetaSynthesisContributionSchema
>;

// ── Top-level meta-synthesis result ──────────────────────────────────────────

export const MetaSynthesisResultSchema = z.object({
  /** 3-5 sentences, the cross-study "above the fold": what emerged when these
   *  studies are read together? In cross-study language; a paragraph, not a
   *  list. Prose — NOT anchor-checked per sentence (mirrors study_synthesis
   *  overview), so it must stay faithful to the cited material below. */
  overview: z.string().min(1).max(2500),
  /** Themes independently present in ≥2 of the studies. Empty is a VALID answer
   *  when the studies share no signal — do NOT manufacture convergence. */
  convergent_themes: z
    .array(MetaSynthesisConvergentThemeSchema)
    .max(12)
    .default([]),
  /** Real disagreements BETWEEN studies. Empty is VALID (full agreement). NEVER
   *  manufacture a divergence to balance a convergence. */
  divergences: z.array(MetaSynthesisDivergenceSchema).max(8).default([]),
  /** Optional: per-study unique contributions — what a single study surfaced
   *  that the others did not. Empty is fine. */
  study_contributions: z
    .array(MetaSynthesisContributionSchema)
    .max(12)
    .default([]),
  /** OPTIONAL non-anchored soft channel (identical posture to the
   *  Cross-Study-Agent's `interpretation`): a cross-study observation the
   *  synthesizer could back with NEITHER a study count NOR per-study citations.
   *  Rendered as "Interpretation (nicht direkt belegt)", never as fact. Empty by
   *  default; MUST NOT carry frequency/"in N Studien" numbers. */
  interpretation: z.string().max(1500).default(""),
});
export type MetaSynthesisResult = z.infer<typeof MetaSynthesisResultSchema>;

// ── Request (drives the POST route in E2) ────────────────────────────────────

export const MetaSynthesisRequestSchema = z.object({
  /** Org whose syntheses may be meta-synthesized (org-scoped; the route sets
   *  this server-side, NEVER from the body). */
  orgId: z.string().min(1).max(200),
  /** The studies to compare — plan_ids. A meta-synthesis needs ≥2. Capped so
   *  one call can't fan out unboundedly. */
  studyIds: z.array(z.string().min(1).max(200)).min(2).max(20),
  /** Optional focus, e.g. the question the user asked in the Cross-Study chat
   *  that triggered this ("Wie unterscheidet sich das Onboarding-Verständnis?").
   *  Steers emphasis; never widens the evidence. */
  focus: z.string().max(2000).optional(),
  /** Optional human title for the persisted artifact. Falls back to an
   *  auto-generated one in the engine/service. */
  title: z.string().max(200).optional(),
});
export type MetaSynthesisRequest = z.infer<typeof MetaSynthesisRequestSchema>;

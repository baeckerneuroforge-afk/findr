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
   *  the eval flags quote-less themes for human review. */
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
});

export type StudySynthesisResult = z.infer<typeof StudySynthesisResultSchema>;

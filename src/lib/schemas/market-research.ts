import { z } from "zod";

import {
  INTENSITY_LEVELS,
  SENTIMENT_VALUES,
} from "@/lib/schemas/product-discovery";

/**
 * Market Research classifier schema — Phase M0 type foundation.
 *
 * Sibling of schemas/product-discovery.ts, deliberately the SAME container
 * shape: a coded finding is `{ category, title, description, intensity,
 * confidence, evidence[] }` plus per-call themes + respondent context +
 * sentiment + summary. That is the central finding of the separation plan
 * (docs/findr-market-research-separation-plan.md, Ebene 3): Market Research and
 * Product Discovery diverge on the ANALYSIS LENS (vocabulary + prompt), NOT on
 * structure. So this schema does NOT introduce a new data structure — it
 * reuses the shared coding-container with a different category vocabulary.
 *
 * Two deliberate divergences from product-discovery.ts, both lens-level:
 *  1. ONE `findings` array instead of the feature/pain split. The B2B
 *     featureRequest-vs-painPoint distinction is a product-feedback construct;
 *     a market respondent (who often uses no product at all) produces market
 *     signal that doesn't cleave that way. One category enum carries it.
 *  2. A market category vocabulary (MARKET_FINDING_CATEGORIES) covering exactly
 *     the five market-insight rows that the B2B extraction prompt actively
 *     DISCARDS (separation plan §2): price sensitivity, purchase intent,
 *     competitive perception, segment need, brand/attitude.
 *
 * The intensity scale (INTENSITY_LEVELS) and SENTIMENT_VALUES are imported,
 * not redefined — they are intentionally IDENTICAL to product-discovery, which
 * keeps a market study compatible with the (already type-agnostic) shared
 * synthesis engine and leaves §9's storage decision (a: reuse arrays vs.
 * b: dedicated column) fully open.
 *
 * M0 SCOPE: this file is DEFINITION ONLY. Nothing imports it into the live
 * extraction path; switching the classifier to it is M1/M2. No persisted rows
 * carry this shape yet, so there are no read-side normalizers here (those land
 * with the first consumer, mirroring product-discovery's normalizeThemes).
 */

const toLowerString = (v: unknown) =>
  typeof v === "string" ? v.toLowerCase() : v;
const toUpperString = (v: unknown) =>
  typeof v === "string" ? v.toUpperCase() : v;

// ── Market finding categories ────────────────────────────────────────────────

/**
 * Generic starting vocabulary for market research — 1:1 with the five
 * market-insight rows in separation plan §2 that the B2B Product Discovery
 * lens throws away. Refinement against real transcripts in the first eval
 * rounds, exactly like the product-discovery and health vocabularies were
 * calibrated. Each value names a MARKET signal, not a product-feedback signal.
 */
export const MARKET_FINDING_CATEGORIES = [
  // Preis-Sensitivität / Zahlungsbereitschaft — price thresholds, willingness
  // to pay, value-for-money perception. (B2B lens: "pricing … Skip".)
  "PRICE_SENSITIVITY",
  // Kaufabsicht / Consideration / Kauf-Trigger — intent to buy or switch,
  // decision criteria, what would move the respondent to purchase.
  "PURCHASE_INTENT",
  // Wettbewerbs-Wahrnehmung / Positionierung — how the respondent sees
  // competitors / alternatives / the category. (B2B lens: "competitor's
  // product … skip".)
  "COMPETITIVE_PERCEPTION",
  // Unerfüllte Marktbedürfnisse auf Populations-Ebene (NICHT Produkt-Feature) —
  // a need the market has that nothing serves well today.
  "SEGMENT_NEED",
  // Allgemeine Einstellung / Markenwahrnehmung — attitude toward the brand /
  // category / concept, awareness, associations. (B2B lens: general attitude
  // is treated as "HEALTH signal … Skip".)
  "BRAND_PERCEPTION",
] as const;
export type MarketFindingCategory = (typeof MARKET_FINDING_CATEGORIES)[number];

// ── Shared scales (re-exported, intentionally identical to product-discovery) ─

export { INTENSITY_LEVELS, SENTIMENT_VALUES };
export type { IntensityLevel, Sentiment } from "@/lib/schemas/product-discovery";

// ── Item schema ──────────────────────────────────────────────────────────────

/**
 * One coded market finding. Same shape as product-discovery's FeatureRequest
 * (case-insensitive enum preprocess, verbatim evidence, honest confidence) —
 * only the category vocabulary differs. `intensity` here reads as MARKET-SIGNAL
 * STRENGTH (how strongly the respondent holds the signal); the shared
 * `blocker` step maps to a hard market barrier ("would never buy at any price",
 * "would never switch"), so the scale stays meaningful without a parallel enum.
 */
const MarketFindingSchema = z.object({
  category: z.preprocess(toUpperString, z.enum(MARKET_FINDING_CATEGORIES)),
  /** AI-formulierte Kurzform of the finding (3–120 chars). */
  title: z.string().min(3).max(120),
  description: z.string().min(1).max(2000),
  intensity: z.preprocess(toLowerString, z.enum(INTENSITY_LEVELS)),
  /** 0 = barely mentioned, 1 = explicit and repeated. The classifier is told
   *  to DROP items with confidence < 0.3 rather than emit them. */
  confidence: z.number().min(0).max(1),
  /** Verbatim quotes from the transcript ONLY — never paraphrase. The prompt
   *  requires ≥1 entry; the schema keeps the array allowed to be empty so a
   *  downstream filter (the future M1/M2 service layer) can decide whether to
   *  drop or surface borderline items, mirroring the product-discovery
   *  classifier's post-validation filter on confidence + quotes. */
  evidence: z.array(z.string()).max(5).default([]),
});
export type MarketFinding = z.infer<typeof MarketFindingSchema>;

// ── Theme ────────────────────────────────────────────────────────────────────

/** A theme is a CLUSTERING over already-extracted findings — it references at
 *  least one finding by its array index. Themes never introduce new content;
 *  if findings don't cluster naturally, the array stays empty. Mirror of
 *  product-discovery's ThemeSchema with a single `relatedFindingIndices`
 *  (there is one findings array here, not two). */
const MarketThemeSchema = z.object({
  label: z.string().min(3).max(80),
  summary: z.string().min(1).max(500),
  relatedFindingIndices: z.array(z.number().int().nonnegative()).default([]),
});
export type MarketTheme = z.infer<typeof MarketThemeSchema>;

// ── Top-level result ─────────────────────────────────────────────────────────

export const MarketResearchResultSchema = z.object({
  findings: z.array(MarketFindingSchema).max(15).default([]),
  themes: z.array(MarketThemeSchema).max(8).default([]),
  summary: z.string().min(1).max(3000),
  /** Respondent role — wie sich der Sprecher positioniert. Im Markt-Kontext
   *  oft eine Konsumenten-/Markt-Rolle ("Elternteil, urban", "Einkäufer im
   *  Mittelstand") statt einer B2B-Funktion. NULL wenn das Transkript schweigt
   *  — nicht raten. Gleiche Posture wie product-discovery. */
  respondentRole: z.string().min(1).max(120).nullable().default(null),
  /** Respondent segment — Markt-/Bevölkerungs-Segment soweit das Transkript es
   *  hergibt ("urbane Familien 30-45", "SMB-Eigentümer DACH"). NULL wenn
   *  unklar. */
  respondentSegment: z.string().min(1).max(120).nullable().default(null),
  /** Tonalität des respondent zum untersuchten Gegenstand (Marke / Kategorie /
   *  Konzept). Default neutral, falls das Modell die Stelle elidiert — gleiche
   *  Behandlung wie product-discovery. */
  sentiment: z
    .preprocess(toLowerString, z.enum(SENTIMENT_VALUES))
    .default("neutral"),
  /** Single source for this etappe; richer sources can be added later as a
   *  discriminated union — same evolution path as product-discovery. */
  source: z.literal("transcript").default("transcript"),
});

export type MarketResearchResult = z.infer<typeof MarketResearchResultSchema>;

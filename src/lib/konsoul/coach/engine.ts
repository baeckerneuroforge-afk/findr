import "server-only";

import { z } from "zod";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import { fold } from "@/lib/mission-control/engine";
import type { KonsoulSignal } from "@/lib/konsoul/signals";
import {
  KONSOUL_COACH_SYSTEM_PROMPT,
  buildCoachUserMessage,
} from "./prompts";

/**
 * Konsoul COACH engine (Orchestrator P4) — turns the ALREADY-deterministically-
 * computed next-steps + signals into a warm, study-specific coaching HEADLINE,
 * with the honesty contract enforced STRUCTURALLY (not just by prompt).
 *
 * What Opus may produce: ONE short imperative headline per item ("Verdichte die
 * ersten Stimmen", "Hol mehr Teilnehmer für «Pricing» ein"). What it may NEVER
 * do: invent or restate a NUMBER, or name a study/theme that wasn't given.
 *
 * Why this is safe by construction (mirrors the cross-study agent's anchor
 * filter — the repo's sacred grounding primitive):
 *  - Every COUNT stays in the DETERMINISTIC sub-label the page already renders
 *    (`desc` "5 Interviews", `evidenceLabel` "Beleg: 3 Studien"). The coach
 *    headline therefore carries NO invented number — neither a digit (the filter
 *    strips the title phrase and rejects any remaining digit, so a count is
 *    allowed only AS PART OF the title like "Pricing 2.0", never as a free-
 *    standing "3 Gespräche") nor a spelled-out cardinal ("sieben") that isn't a
 *    token of the title. A model that injects "7"/"sieben interviews" fails the
 *    filter and the item silently falls back to its deterministic text.
 *  - For signal items the study title / theme is REQUIRED to appear verbatim as
 *    a WHOLE fold()-token (the same canonical fold the matching anchors use), so
 *    a headline that drops or invents an entity — or only matches it inside an
 *    unrelated word — is rejected → deterministic fallback. (Next-step cards
 *    append the title themselves, so they don't require it in the headline.)
 *
 * Fail-OPEN at the top: `runKonsoulCoach` never throws and returns an empty Map
 * on ANY failure (flag off is handled one layer up in service.ts) — the Heute
 * page then renders its deterministic cards unchanged. Org-scoping is the
 * caller's job (the items are already built from org-scoped reads); this engine
 * touches no DB and never sees an orgId.
 *
 * The pure derivation (`buildCoachItems`) and the anchor filter
 * (`applyCoachAnchorFilter`) have no DB / network / LLM, so the unit test drives
 * them directly; `runKonsoulCoachWith(items, locale, delegate)` is the DI seam
 * (a fake delegate replaces the Opus call), exactly like `runKonsoulAgentWith`.
 */

// ── Model / version stamps ───────────────────────────────────────────────────

/** Opus for the framing (trust-critical natural language, parity with the
 *  cross-study delegation). NEVER overridable by a caller. */
export const KONSOUL_COACH_MODEL: string = CLAUDE_MODELS.opus;
export const KONSOUL_COACH_PROMPT_VERSION = "konsoul-coach-p4.0";

/** Max length of a single coaching headline (schema-enforced + filter-enforced).
 *  A headline is a one-liner; anything longer is treated as the model going off
 *  the rails → dropped → deterministic fallback. */
export const MAX_COACH_HEADLINE_LEN = 160;

// ── Item model (the deterministic INPUT to the coach) ────────────────────────

export type CoachItemKind =
  // next-step rules (R1/R2/R3) — the title is appended by the card, so the
  // headline does NOT have to name the study.
  | "synthesis_gap"
  | "dead_field"
  | "old_draft"
  // "Konsoul schlägt vor" signals — the headline DOES name the study/theme
  // (the card has no separate title line), so the entity is a required anchor.
  | "persona_gate"
  | "persona_quality"
  | "recurring_theme";

export interface CoachItem {
  /** Stable key — identical to the next-step/signal key the card renders under,
   *  so a returned frame maps back 1:1 to its card. */
  key: string;
  kind: CoachItemKind;
  /** The plan title or theme phrase this item is about. Used (a) as the required
   *  anchor for signal items and (b) to compute which digit-runs are legitimately
   *  allowed in the headline (a title like "Pricing 2.0" may surface "2"/"0"). */
  entity: string;
  /** Signals require the entity verbatim in the headline; next-step cards append
   *  the title themselves, so they do not. */
  requireEntity: boolean;
}

/** Discriminates next-step keys (`synthesis-…`/`field-…`/`draft-…`) into kinds.
 *  Returns null for an unknown prefix (skipped — never guessed). */
function nextStepKind(key: string): CoachItemKind | null {
  if (key.startsWith("synthesis-")) return "synthesis_gap";
  if (key.startsWith("field-")) return "dead_field";
  if (key.startsWith("draft-")) return "old_draft";
  return null;
}

/** Structural subset of a Heute next-step the coach needs (key encodes the rule,
 *  planTitle is the entity). Avoids importing the page-local HeuteNextStep type. */
export interface NextStepLike {
  key: string;
  planTitle: string;
}

/**
 * Build the deterministic coach items from the page's already-computed next-steps
 * (R1/R2/R3) and Konsoul signals. PURE: no DB, no LLM, no clock. The order is
 * next-steps first (matching the card order), then signals.
 */
export function buildCoachItems(
  nextSteps: NextStepLike[],
  signals: KonsoulSignal[],
): CoachItem[] {
  const items: CoachItem[] = [];

  for (const step of nextSteps) {
    const kind = nextStepKind(step.key);
    if (!kind) continue;
    items.push({
      key: step.key,
      kind,
      entity: step.planTitle,
      // The card renders "… — {planTitle}" itself; the headline must not repeat
      // it (would read "Verdichte Pricing — Pricing").
      requireEntity: false,
    });
  }

  for (const signal of signals) {
    const entity =
      signal.evidence.type === "theme"
        ? signal.evidence.theme
        : signal.evidence.planTitle;
    items.push({
      key: signal.key,
      kind: signal.kind,
      entity,
      // The signal card has no separate title line → the headline must name the
      // study/theme, enforced as a required anchor.
      requireEntity: true,
    });
  }

  return items;
}

// ── Output schema (forced tool-use) ──────────────────────────────────────────

const CoachFrameSchema = z.object({
  /** Must match one of the input item keys (validated again in the filter). */
  key: z.string().min(1).max(200),
  /** The reframed one-line coaching headline. */
  headline: z.string().min(1).max(MAX_COACH_HEADLINE_LEN),
});

export const KonsoulCoachResultSchema = z.object({
  frames: z.array(CoachFrameSchema).max(12),
});

export type KonsoulCoachResult = z.infer<typeof KonsoulCoachResultSchema>;

/** Map key → reframed headline. Only items that PASSED the anchor filter appear;
 *  every other key falls back to its deterministic text at render time. */
export type CoachFrames = Map<string, string>;

// ── Honesty anchor filter (the structural guarantee) ─────────────────────────

/** Spelled-out cardinal numbers (FOLDED forms — fold() lowercases + maps
 *  ä/ö/ü/ß → ae/oe/ue/ss). A headline may not restate a count in WORDS any more
 *  than in digits; a cardinal word is allowed ONLY when it is literally a token
 *  of the study title (e.g. „Drei Säulen"). Deliberately EXCLUDES the German
 *  articles ein/eine/einer and vague quantifiers (mehr, mehrere, einige) — those
 *  are legitimate coaching language, not a fabricated count. */
const NUMBER_WORDS: ReadonlySet<string> = new Set([
  // de
  "zwei", "drei", "vier", "fuenf", "sechs", "sieben", "acht", "neun", "zehn",
  "elf", "zwoelf", "dreizehn", "vierzehn", "fuenfzehn", "sechzehn", "siebzehn",
  "achtzehn", "neunzehn", "zwanzig", "dreissig", "vierzig", "fuenfzig",
  "sechzig", "siebzig", "achtzig", "neunzig", "hundert", "hunderte", "tausend",
  "dutzend", "dutzende",
  // en
  "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty",
  "seventy", "eighty", "ninety", "hundred", "hundreds", "thousand",
  "dozen", "dozens",
]);

/** fold()-tokenize on non-alphanumerics. fold() output is lowercase a-z / 0-9
 *  plus separators, so this yields the string's word/number tokens. */
function foldTokens(s: string): string[] {
  return fold(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Is a single FOLDED token a spelled-out count? Covers the simple cardinals
 *  (NUMBER_WORDS) plus the open morphology the set can't enumerate: German
 *  closed compounds (einundzwanzig … neunundneunzig) and the hundert/tausend/
 *  dutzend morphemes in either language (zweihundert, hunderteins, dozen…). A
 *  token that happens to be part of the study title is exempted by the caller. */
function isNumberWordToken(tok: string): boolean {
  if (NUMBER_WORDS.has(tok)) return true;
  // German closed compounds: (ein..neun)und(zwanzig..neunzig).
  if (
    /^(ein|zwei|drei|vier|fuenf|sechs|sieben|acht|neun)und(zwanzig|dreissig|vierzig|fuenfzig|sechzig|siebzig|achtzig|neunzig)$/.test(
      tok,
    )
  ) {
    return true;
  }
  // Large-count morphemes anywhere in the token (zweihundert, dreitausend, …).
  return /(hundert|tausend|dutzend|hundred|thousand|dozen)/.test(tok);
}

/** True iff the already-folded `needle` occurs in the already-folded `hay` as a
 *  WHOLE token — bounded by the string ends or a non-alphanumeric char. Stops a
 *  short theme like „KI" from matching inside an unrelated word (“marKIerung”).
 *  Empty needle ⇒ false (an empty title can never be anchored — closes the
 *  fold("")-substring-always-true hole). */
function containsAsToken(hay: string, needle: string): boolean {
  if (needle.length === 0) return false;
  for (let from = 0; ; ) {
    const idx = hay.indexOf(needle, from);
    if (idx === -1) return false;
    const before = idx === 0 ? "" : hay[idx - 1];
    const after =
      idx + needle.length >= hay.length ? "" : hay[idx + needle.length];
    const okBefore = before === "" || !/[a-z0-9]/.test(before);
    const okAfter = after === "" || !/[a-z0-9]/.test(after);
    if (okBefore && okAfter) return true;
    from = idx + 1;
  }
}

/**
 * Keep only the frames that honour the contract. For each returned frame:
 *  1. its key must be a known input item (no orphan/foreign key);
 *  2. the headline is non-empty after trim and within length;
 *  3. (signals) the study/theme must appear verbatim as a WHOLE fold()-token
 *     (an empty or merely-substring match is rejected);
 *  4. NO exotic Unicode number (Roman numerals, fractions, circled, non-Latin
 *     digits) — they'd restate a count outside the ASCII-digit gate;
 *  5. NO invented ASCII digit: after removing the (folded) title phrase, NO
 *     digit may remain — a number is allowed only as part of the title itself
 *     („Pricing 2.0"), never as a free-standing „3 Gespräche" (also closes the
 *     laundering hole where a stray digit equals a title digit, incl. when the
 *     title IS a bare number);
 *  6. NO invented spelled-out count: a cardinal / German compound number-word is
 *     allowed only if it is one of the title's own tokens.
 * A duplicate key keeps only the FIRST valid frame.
 *
 * SCOPE NOTE (honest about the hard guard): this structurally blocks every
 * digit/Unicode-numeric form and common + compound spelled cardinals. Two narrow
 * encodings — ASCII Roman numerals typed as letters ("VIII") and ordinals
 * ("zwölfte") — are left to the PROMPT (soft guard), because a robust structural
 * check collides with legitimate words/acronyms. This is low-risk by design: the
 * model is never given the count (prompts only carry kind + study name), so it
 * has nothing to restate — any number would be a spontaneous invention, which an
 * Opus told "write no number" essentially never does.
 */
export function applyCoachAnchorFilter(
  items: CoachItem[],
  frames: { key: string; headline: string }[],
): CoachFrames {
  const byKey = new Map(items.map((it) => [it.key, it]));
  const out: CoachFrames = new Map();

  for (const frame of frames) {
    const item = byKey.get(frame.key);
    if (!item) continue; // unknown key — never trust it
    if (out.has(frame.key)) continue; // first valid wins

    const headline = frame.headline.trim();
    if (headline.length === 0 || headline.length > MAX_COACH_HEADLINE_LEN) {
      continue;
    }

    const foldedHeadline = fold(headline);
    const foldedEntity = fold(item.entity);

    // (3) required entity (signals) must be present as a whole token.
    if (item.requireEntity && !containsAsToken(foldedHeadline, foldedEntity)) {
      continue;
    }

    // (4) no exotic Unicode number: Roman numerals (Ⅷ, category Nl), fractions
    //     (½) / circled / fullwidth / superscript (No), and non-Latin digits
    //     (٧, a non-ASCII Nd) all restate a count OUTSIDE the ASCII-digit gate
    //     below (fold()'s NFKC turns Ⅷ into the letters "viii"). None has any
    //     place in a coaching headline, so reject the frame outright.
    if (
      /[\p{Nl}\p{No}]/u.test(headline) ||
      /\p{Nd}/u.test(headline.replace(/[0-9]/g, ""))
    ) {
      continue;
    }

    // (5) no invented ASCII digit: strip the title phrase (ONLY when the title
    //     actually contains a letter — a title that is itself a bare number like
    //     "7" can't safely "anchor" a digit, else the strip would erase a
    //     genuinely fabricated "7" too), then reject any remaining digit. A count
    //     survives only AS PART OF a real title like "Pricing 2.0".
    const entityHasLetters = /[a-z]/.test(foldedEntity);
    const stripped =
      foldedEntity.length > 0 && entityHasLetters
        ? foldedHeadline.split(foldedEntity).join(" ")
        : foldedHeadline;
    if (/\d/.test(stripped)) continue;

    // (6) no invented spelled-out count: a cardinal / compound number-word is
    //     allowed only if it is one of the title's own tokens.
    const entityTokens = new Set(foldTokens(item.entity));
    const hasForeignNumberWord = foldTokens(headline).some(
      (tok) => isNumberWordToken(tok) && !entityTokens.has(tok),
    );
    if (hasForeignNumberWord) continue;

    out.set(frame.key, headline);
  }

  return out;
}

// ── Engine (DI seam) ─────────────────────────────────────────────────────────

/** The LLM step, injectable so tests run offline. Given the items + locale it
 *  returns the model's raw (schema-valid) frames; it MAY throw (the caller is
 *  fail-open). */
export type CoachDelegate = (
  items: CoachItem[],
  locale: string,
) => Promise<KonsoulCoachResult>;

export class KonsoulCoachUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "KonsoulCoachUnavailableError";
  }
}

/**
 * Core: run the framing delegate, then ANCHOR-FILTER its output. Fail-open: any
 * thrown delegate error yields an empty Map (every card falls back to its
 * deterministic text). No items → no call → empty Map.
 */
export async function runKonsoulCoachWith(
  items: CoachItem[],
  locale: string,
  delegate: CoachDelegate,
): Promise<CoachFrames> {
  if (items.length === 0) return new Map();
  try {
    const result = await delegate(items, locale);
    return applyCoachAnchorFilter(items, result.frames);
  } catch (err) {
    // Fail-open: a coach failure must NEVER degrade the Heute page. Log for
    // observability only.
    console.error("[konsoul-coach] framing failed, falling back:", err);
    return new Map();
  }
}

/** Production delegate: one forced-tool-use Opus call. Throws on transport /
 *  schema failure → runKonsoulCoachWith maps it to the empty-Map fallback. */
export const productionCoachDelegate: CoachDelegate = async (items, locale) => {
  try {
    return await callClaudeStructured<KonsoulCoachResult>({
      schema: KonsoulCoachResultSchema,
      system: KONSOUL_COACH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildCoachUserMessage(items, locale) }],
      model: KONSOUL_COACH_MODEL,
      maxTokens: 700,
      toolName: "emit_coaching",
      toolDescription:
        "Return the reframed coaching headlines as the structured frames of this tool.",
      // Best-effort gloss: a failed/slow frame already falls back deterministically,
      // so suppress SDK transient HTTP retries (they'd multiply the 12s per-call
      // bound). The service additionally races a hard 12s wall-clock deadline.
      timeoutMs: 12_000,
      maxRetries: 0,
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      throw new KonsoulCoachUnavailableError(
        "coach model produced invalid output",
        err,
      );
    }
    throw err;
  }
};

/** Production entry: frame the items with Opus, anchor-filtered, fail-open. */
export async function runKonsoulCoach(
  items: CoachItem[],
  locale: string,
): Promise<CoachFrames> {
  return runKonsoulCoachWith(items, locale, productionCoachDelegate);
}

import { z } from "zod";

/**
 * Research-Agent — the request/response contract for the deliverable builder
 * that works ON a finished study synthesis (Stage-2 emergent_themes + tensions
 * + overview), NOT on raw transcripts (DSGVO + token cost). A researcher fires
 * a free-text instruction ("fasse die Hauptbefunde als 5 Bullet-Points
 * zusammen", "mach einen Breakdown der Spannungen", "welche 3 Themen sind am
 * wichtigsten und warum") and the engine returns a STRUCTURED deliverable whose
 * every claim is anchored to something that actually exists in the synthesis.
 *
 * Same anti-hallucination posture as chatWithData / synthesizeStudy:
 *   1. SCHEMA   — Zod validates the response SHAPE (fulfilled / type / items).
 *   2. ANCHORS  — every item must cite a theme/tension/quote the engine can
 *                 re-find in the synthesis; unanchored items are DROPPED, and a
 *                 deliverable whose items are ALL dropped is downgraded to
 *                 fulfilled=false ("steht nicht in den Daten").
 *
 * This module is the LEAF contract — pure Zod, no `server-only`, no engine
 * imports — so both the engine and the eval harness can import it freely.
 */

// ── Deliverable type (the classifier output) ────────────────────────────────

/** The shape of deliverable the agent decided the instruction asked for. The
 *  eval scores instruction-following against this. "custom" is the catch-all
 *  for any other answerable deliverable (a headline, a single key takeaway). */
export const DELIVERABLE_TYPES = [
  "summary",
  "breakdown",
  "theme_ranking",
  "custom",
] as const;

export const DeliverableTypeSchema = z.enum(DELIVERABLE_TYPES);
export type DeliverableType = z.infer<typeof DeliverableTypeSchema>;

// ── Deliverable item ────────────────────────────────────────────────────────

/** One unit of the deliverable — a bullet, a ranked theme, a breakdown row.
 *  Carries its own anchors so the engine can verify EACH item independently
 *  (mirrors ChatCitation: a claim is only as trustworthy as its anchor). */
export const DeliverableItemSchema = z.object({
  /** Short label for the unit (a bullet headline, the ranked theme's name, a
   *  breakdown part). Optional — prose can live entirely in `text`. */
  heading: z.string().max(200).default(""),
  /** The deliverable prose for this unit, in German. */
  text: z.string().min(1).max(1500),
  /** Findings this item is grounded in — each MUST be a verbatim emergent-theme
   *  title or tension description from the synthesis. The engine drops refs it
   *  can't re-find (typography-folded) in the synthesis. */
  themeRefs: z.array(z.string()).max(12).default([]),
  /** Verbatim quotes used — each MUST appear literally in the synthesis text
   *  after typography folding. The engine drops paraphrased quotes. NEVER
   *  translated — quotes stay in their source language. */
  quotes: z.array(z.string()).max(8).default([]),
});
export type DeliverableItem = z.infer<typeof DeliverableItemSchema>;

// ── Response ────────────────────────────────────────────────────────────────

/**
 * Self-Healing für die items-als-String-Macke (GATE-RED-Befund,
 * docs/findr-research-agent-gate-befund.md): Unter Präzisionsdruck
 * (Exakt-Zahl-Fragen) emittiert das Modell `items` gelegentlich als
 * JSON-ENCODIERTEN String statt als Array — valides JSON-Objekt, falscher
 * Feldtyp, vom generischen Retry nicht heilbar. Hier wird AUSSCHLIESSLICH
 * dieser eine Fall repariert: ein String, der getrimmt wie ein JSON-Array
 * aussieht und sich zu einem Array parsen lässt, wird entpackt. Alles andere
 * (Müll-Strings, Objekte, Zahlen) fällt unverändert in die normale
 * Zod-Fehlerbahn — und die Element-Validierung (DeliverableItemSchema) plus
 * das nachgelagerte Anchor-Filter laufen über das geheilte Array genauso wie
 * über ein nativ geliefertes; es kann nichts durchrutschen, was vorher
 * abgelehnt worden wäre.
 */
function coerceJsonArrayString(value: unknown): unknown {
  if (typeof value !== "string" || !value.trim().startsWith("[")) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

export const ResearchAgentResponseSchema = z.object({
  /** false = the instruction cannot be fulfilled from THIS synthesis (asks for
   *  data the synthesis does not contain). The honest-refusal contract: an
   *  empty `items` and a 1-sentence `note`. */
  fulfilled: z.boolean(),
  /** The classifier's call on what kind of deliverable this is. Defaulted to
   *  "custom" so a model that omits it still parses (scored as custom). */
  deliverableType: DeliverableTypeSchema.default("custom"),
  /** Short German headline for the whole deliverable. Empty on refusal. */
  title: z.string().max(200).default(""),
  /** The deliverable body, one entry per bullet / ranked theme / breakdown
   *  part. Empty on refusal. z.preprocess = Self-Healing für den
   *  String-statt-Array-Fall (siehe coerceJsonArrayString oben). */
  items: z
    .preprocess(coerceJsonArrayString, z.array(DeliverableItemSchema).max(20))
    .default([]),
  /** Honest 1-sentence German note. REQUIRED to be meaningful when
   *  fulfilled=false; empty when fulfilled=true. */
  note: z.string().max(800).default(""),
});
export type ResearchAgentResponse = z.infer<typeof ResearchAgentResponseSchema>;

// ── Conversation history (multi-turn — Etappe 2) ────────────────────────────

/** One prior turn of the researcher↔agent conversation. Mirrors
 *  chat-with-data's ChatHistoryTurn: the engine threads these into the
 *  Anthropic `messages` list verbatim so a follow-up ("mach das kürzer",
 *  "jetzt nach Segment") has conversational continuity. CRITICAL: the history
 *  is conversation context ONLY — it is NEVER an anchor source. The anchor
 *  haystack is rebuilt from the fresh synthesis on every turn, so a follow-up
 *  can't launder a finding that isn't in the synthesis through a prior turn.
 *  The 4000-char cap matches the chat route (a hostile client can't burn
 *  tokens with an oversized turn). */
export const ResearchAgentHistoryTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});
export type ResearchAgentHistoryTurn = z.infer<
  typeof ResearchAgentHistoryTurnSchema
>;

// ── Request ─────────────────────────────────────────────────────────────────

/** DB-driven entry input — instruction + the plan context (org-scoped) + the
 *  prior conversation. Etappe 2 validates this at the route boundary before
 *  calling the engine. `history` is optional (single-shot when absent) so the
 *  Etappe-1 eval path is unchanged. */
export const ResearchAgentRequestSchema = z.object({
  orgId: z.string().min(1).max(200),
  planId: z.string().min(1).max(200),
  instruction: z.string().min(1).max(2000),
  history: z.array(ResearchAgentHistoryTurnSchema).max(20).optional(),
});
export type ResearchAgentRequest = z.infer<typeof ResearchAgentRequestSchema>;

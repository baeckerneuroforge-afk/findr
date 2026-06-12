import "server-only";

import { z } from "zod";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import { callClaudeStructured } from "@/lib/anthropic/structured";
import { createResearchSupabase } from "@/lib/research/db";
import {
  coerceConversation,
  listPlanStimuli,
} from "@/lib/research/plans-service";
import type { InterviewTurn } from "@/lib/voice-agent/interviewer";

/**
 * E7 Multi-Stimulus-Auswertung — Stimulus-Inputs für die Stage-2-Synthese.
 * Baugleich zu signals.ts (E4), dieselben zwei Grundsätze:
 *
 *   1. ZAHLEN RECHNET DER SERVER, NIE DAS MODELL. Gesehen-Zähler je Stimulus
 *      und die Präferenz-Stimmen werden hier deterministisch aggregiert;
 *      das LLM bekommt sie als Faktenblock und darf daraus nur FORMULIEREN
 *      (stimulus_sections / stimulus_comparison). Persistiert wird der
 *      Server-Block (study_synthesis.stimulus_summary), die UI zeigt
 *      Kennzahlen ausschließlich von dort.
 *
 *   2. MINDEST-N PRO STIMULUS-SEGMENT (Plan E7): eine LLM-Sektion gibt es
 *      nur für Stimuli, die ≥ MIN_STIMULUS_SEGMENT_SESSIONS Interviews
 *      gesehen haben; die Präferenz-Zählung läuft nur, wenn ≥ Mindest-N
 *      Interviews ALLE Stimuli gesehen haben (vorher gäbe es nichts
 *      Belastbares zu vergleichen — und keine Haiku-Calls).
 *
 * PRÄFERENZ-ERKENNUNG: Die Pflicht-Präferenzfrage (E4-Regie, N ≥ 2) liefert
 * Freitext. Die Zuordnung Antwort→Stimulus ist eine KLASSIFIKATION pro
 * Session (Haiku, Muster turn-signals E1) — gezählt wird ausschließlich
 * server-seitig über die klassifizierten Felder. Fail-open pro Session:
 * ein gescheiterter Call fällt aus der Zählung, nie aus der Synthese.
 *
 * KOSTENHALTUNG: Der Engine-Guardrail „nie Roh-Transkripte in den Prompt"
 * bekommt hier eine BEWUSSTE, eng gedeckelte Ausnahme: per-Stimulus-
 * Reaktionen existieren in keiner verdichteten Form (Stage-1-Insights sind
 * nicht stimulus-segmentiert), und Sektion-Quotes müssen wörtlich belegbar
 * sein. Deshalb reisen je Stimulus höchstens MAX_EXCERPTS_PER_STIMULUS
 * Erstreaktions-Ausschnitte à MAX_EXCERPT_CHARS Zeichen in den Prompt —
 * bei Cap 5 Stimuli ≤ ~8 KB, ein Bruchteil des Insight-Blocks.
 */

export const MIN_STIMULUS_SEGMENT_SESSIONS = 3;
/** Obergrenze der betrachteten Sessions (Spiegel von SIGNAL_SESSION_LIMIT). */
const STIMULUS_SESSION_LIMIT = 50;
/** Erstreaktions-Ausschnitte je Stimulus im Prompt (Token-Hygiene). */
const MAX_EXCERPTS_PER_STIMULUS = 6;
const MAX_EXCERPT_CHARS = 280;
/** Gesprächs-Schwanz für die Präferenz-Klassifikation (ab letztem Reveal). */
const MAX_PREFERENCE_TAIL_TURNS = 10;
const MAX_PREFERENCE_TURN_CHARS = 500;

export const DEFAULT_STIMULUS_PREFERENCE_MODEL = CLAUDE_MODELS.haiku;

function resolvePreferenceModel(): string {
  return (
    process.env.STIMULUS_PREFERENCE_MODEL ?? DEFAULT_STIMULUS_PREFERENCE_MODEL
  );
}

// ── Server-Zahlen (persistiert als study_synthesis.stimulus_summary) ────────

export interface StimulusSummaryItem {
  position: number;
  label: string | null;
  type: string;
  /** Abgeschlossene Sessions, in denen dieser Stimulus eingeblendet wurde. */
  seenSessions: number;
}

export interface StimulusPreferenceCounts {
  /** Sessions mit Voll-Reveal, deren Präferenz-Klassifikation gelang. */
  counted: number;
  votes: Array<{ position: number; count: number }>;
  /** Klassifiziert als „keine klare Präferenz geäußert". */
  none: number;
}

export interface StimulusSummary {
  version: 1;
  setSize: number;
  /** Abgeschlossene Research-Sessions des Plans (Betrachtungsmenge). */
  totalSessions: number;
  items: StimulusSummaryItem[];
  /** Sessions, die ALLE Stimuli des Sets gesehen haben. */
  fullRevealSessions: number;
  /** Null unter Mindest-N (fullRevealSessions < 3) oder bei Set-Größe 1. */
  preference: StimulusPreferenceCounts | null;
}

/** Faktenblock für den Prompt — Server-Zahlen + gedeckelte Erstreaktionen. */
export interface StimulusPromptBlock {
  summary: StimulusSummary;
  /** Positionen mit Mindest-N — NUR für diese darf das Modell Sektionen
   *  schreiben (Engine-Filter erzwingt das zusätzlich). */
  eligiblePositions: number[];
  excerpts: Array<{
    position: number;
    label: string | null;
    excerpts: string[];
  }>;
}

export interface SynthesisStimulusInputs {
  /** Prompt-Block; null → der Prompt trägt keinen Stimulus-Anteil und die
   *  Engine erzwingt leere stimulus_sections + comparison null. */
  block: StimulusPromptBlock | null;
  /** Server-Zahlen für die Persistenz — können AUCH unter Mindest-N gesetzt
   *  sein (ehrliche „noch zu wenige Interviews"-Anzeige), solange das Set
   *  existiert und Sessions vorliegen. */
  summary: StimulusSummary | null;
}

// ── Pure Segment-/Aggregations-Logik (exported for unit tests) ──────────────

/** Sicht EINER Session auf das Set, aus den persistierten SHOW-Markern. */
export interface SessionStimulusView {
  /** Distinkte gesehene Positionen (geklemmt 1..setSize). */
  seenPositions: number[];
  /** Erste Teilnehmer-Antwort nach dem ERSTEN Reveal jeder Position. */
  firstAnswers: Array<{ position: number; answer: string }>;
  /** Gesprächs-Schwanz ab dem ersten Reveal der höchsten Position —
   *  Material der Präferenz-Klassifikation (leer ohne Voll-Reveal). */
  preferenceTail: Array<{ role: "agent" | "customer"; text: string }>;
}

export function computeSessionStimulusView(
  conversation: InterviewTurn[],
  setSize: number,
): SessionStimulusView {
  const seen = new Set<number>();
  const firstAnswers: Array<{ position: number; answer: string }> = [];
  /** Positionen, deren erste Teilnehmer-Antwort noch aussteht. */
  let pendingFirstAnswer: number | null = null;
  let lastRevealIndex = -1;

  conversation.forEach((turn, index) => {
    if (turn.role === "agent") {
      const shown = turn.shownStimulusPosition;
      if (
        typeof shown === "number" &&
        Number.isInteger(shown) &&
        shown >= 1 &&
        shown <= setSize
      ) {
        if (!seen.has(shown)) {
          seen.add(shown);
          pendingFirstAnswer = shown;
          lastRevealIndex = index;
        }
      }
      return;
    }
    if (turn.role === "customer" && pendingFirstAnswer !== null) {
      const text = turn.text.trim();
      if (text) {
        firstAnswers.push({ position: pendingFirstAnswer, answer: text });
      }
      pendingFirstAnswer = null;
    }
  });

  const fullReveal = setSize >= 1 && seen.size === setSize;
  const preferenceTail =
    fullReveal && lastRevealIndex >= 0
      ? conversation
          .slice(lastRevealIndex)
          .slice(-MAX_PREFERENCE_TAIL_TURNS)
          .map((turn) => ({
            role: turn.role,
            text: turn.text.slice(0, MAX_PREFERENCE_TURN_CHARS),
          }))
      : [];

  return {
    seenPositions: [...seen].sort((a, b) => a - b),
    firstAnswers,
    preferenceTail,
  };
}

/**
 * Pure Aggregation (exported for unit tests): Server-Zahlen + Prompt-Block
 * aus den Session-Sichten. `votes` ist die bereits klassifizierte Präferenz
 * pro Voll-Reveal-Session (null-Element = „keine klare Präferenz"); der
 * Caller liefert sie nur, wenn das Mindest-N erreicht war.
 */
export function aggregateStimulusSessions(
  views: SessionStimulusView[],
  items: Array<{ position: number; label: string | null; type: string }>,
  votes: Array<number | null> | null,
): SynthesisStimulusInputs {
  const setSize = items.length;
  if (setSize === 0) return { block: null, summary: null };

  const totalSessions = views.length;
  const summaryItems: StimulusSummaryItem[] = items.map((item) => ({
    position: item.position,
    label: item.label,
    type: item.type,
    seenSessions: views.filter((v) => v.seenPositions.includes(item.position))
      .length,
  }));
  const fullRevealSessions = views.filter(
    (v) => v.seenPositions.length === setSize,
  ).length;

  let preference: StimulusPreferenceCounts | null = null;
  if (votes !== null && setSize >= 2) {
    const counts = new Map<number, number>();
    let none = 0;
    for (const vote of votes) {
      if (vote === null) {
        none += 1;
        continue;
      }
      counts.set(vote, (counts.get(vote) ?? 0) + 1);
    }
    preference = {
      counted: votes.length,
      votes: items
        .map((item) => ({
          position: item.position,
          count: counts.get(item.position) ?? 0,
        }))
        .filter(() => true),
      none,
    };
  }

  const summary: StimulusSummary = {
    version: 1,
    setSize,
    totalSessions,
    items: summaryItems,
    fullRevealSessions,
    preference,
  };

  if (totalSessions === 0) return { block: null, summary };

  const eligiblePositions = summaryItems
    .filter((item) => item.seenSessions >= MIN_STIMULUS_SEGMENT_SESSIONS)
    .map((item) => item.position);

  // Kein einziger Stimulus über Mindest-N und keine Präferenz-Zahlen →
  // der Prompt bleibt byte-identisch zur stimulus-losen Synthese; die
  // Server-Zahlen werden trotzdem persistiert (ehrliche UI-Anzeige).
  if (eligiblePositions.length === 0 && preference === null) {
    return { block: null, summary };
  }

  const excerpts = items
    .filter((item) => eligiblePositions.includes(item.position))
    .map((item) => ({
      position: item.position,
      label: item.label,
      excerpts: views
        .flatMap((v) =>
          v.firstAnswers
            .filter((a) => a.position === item.position)
            .map((a) => a.answer.slice(0, MAX_EXCERPT_CHARS)),
        )
        .slice(0, MAX_EXCERPTS_PER_STIMULUS),
    }));

  return {
    block: { summary, eligiblePositions, excerpts },
    summary,
  };
}

// ── Präferenz-Klassifikation (Haiku, eine Session = ein Call) ───────────────

const PreferenceExtractionSchema = z.object({
  /** 1-basierte Position des bevorzugten Stimulus — null, wenn keine klare
   *  Präferenz geäußert wurde oder die Frage nicht beantwortet ist. */
  preferredPosition: z.number().int().min(1).max(99).nullable(),
});

const PREFERENCE_SYSTEM_PROMPT = `You are coding ONE qualitative interview excerpt for a market-research study. The study showed the participant several stimuli (images/videos/prototypes) in a fixed numbered order; at the end the interviewer asked ONE explicit preference question (which stimulus the participant prefers).

Your ONLY job: read the excerpt and return the NUMBER of the stimulus the participant explicitly prefers.

Rules:
- Return preferredPosition ONLY when the participant clearly states a preference for one stimulus (by number, label, or unambiguous reference like "das erste Bild" / "die blaue Variante" when the stimulus list makes the mapping unambiguous).
- Ambiguous, conditional ("kommt drauf an"), split ("beide gut"), or absent preference → null. When in doubt → null. NEVER guess.
- The mapping must come from the supplied stimulus list. Never invent a number outside it.`;

function buildPreferenceUserPrompt(
  items: Array<{ position: number; label: string | null; type: string }>,
  tail: SessionStimulusView["preferenceTail"],
): string {
  const list = items
    .map(
      (item) =>
        `${item.position}. ${item.label ? `"${item.label}"` : `Stimulus ${item.position}`} (${item.type})`,
    )
    .join("\n");
  const excerpt = tail
    .map(
      (turn) =>
        `${turn.role === "agent" ? "INTERVIEWER" : "PARTICIPANT"}: ${turn.text}`,
    )
    .join("\n");
  return `STIMULI (fixed order):
${list}

FINAL INTERVIEW EXCERPT (after the last stimulus was shown):
${excerpt}

Return JSON only.`;
}

/** Eine Session klassifizieren — fail-open: jeder Fehler ergibt undefined
 *  (Session fällt aus der Zählung), nie einen Synthese-Abbruch. */
async function classifyPreference(
  items: Array<{ position: number; label: string | null; type: string }>,
  tail: SessionStimulusView["preferenceTail"],
  model: string,
): Promise<number | null | undefined> {
  try {
    const result = await callClaudeStructured({
      schema: PreferenceExtractionSchema,
      system: PREFERENCE_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildPreferenceUserPrompt(items, tail) },
      ],
      model,
      maxTokens: 200,
      timeoutMs: 60_000,
      toolName: "emit_stimulus_preference",
      toolDescription:
        "Return the 1-based position of the stimulus the participant explicitly prefers, or null when no clear preference was stated.",
    });
    const position = result.preferredPosition;
    // Klemme gegen das echte Set — eine Position außerhalb wird zur
    // „keine klare Präferenz" (fail-open, nie eine erfundene Stimme).
    if (
      position !== null &&
      !items.some((item) => item.position === position)
    ) {
      return null;
    }
    return position;
  } catch (err) {
    console.warn(
      "[synthesis-stimuli] preference classification failed (session dropped from count):",
      err instanceof Error ? err.message : err,
    );
    return undefined;
  }
}

// ── DB-Loader ───────────────────────────────────────────────────────────────

/**
 * Lädt Set + abgeschlossene Sessions des Plans und baut Server-Zahlen +
 * Prompt-Block. Fail-open wie loadSynthesisSignalInputs: jeder Lesefehler
 * ergibt „keine Stimulus-Inputs", nie einen Synthese-Abbruch. Haiku-Calls
 * laufen NUR, wenn ≥ Mindest-N Sessions alle Stimuli gesehen haben.
 */
export async function loadSynthesisStimulusInputs(
  orgId: string,
  planId: string,
): Promise<SynthesisStimulusInputs> {
  try {
    const stimuli = await listPlanStimuli(orgId, planId);
    if (stimuli.length === 0) return { block: null, summary: null };
    const items = stimuli.map((s) => ({
      position: s.position,
      label: s.label,
      type: s.stimulusType,
    }));

    const supabase = createResearchSupabase();
    const { data, error } = await supabase
      .from("interview_sessions")
      .select("id, conversation, created_at")
      .eq("org_id", orgId)
      .eq("plan_id", planId)
      .eq("kind", "research")
      .eq("status", "completed")
      .order("created_at", { ascending: true })
      .limit(STIMULUS_SESSION_LIMIT);
    if (error || !data) {
      if (error) {
        console.warn(
          `[synthesis-stimuli] session read failed (continuing without stimuli): ${error.message}`,
        );
      }
      return { block: null, summary: null };
    }

    const views = data.map((row) =>
      computeSessionStimulusView(
        coerceConversation(row.conversation),
        items.length,
      ),
    );

    // Präferenz nur ab Mindest-N Voll-Reveal-Sessions und Set ≥ 2 —
    // darunter keine Haiku-Calls und preference bleibt null.
    const fullRevealViews = views.filter(
      (v) => v.seenPositions.length === items.length,
    );
    let votes: Array<number | null> | null = null;
    if (
      items.length >= 2 &&
      fullRevealViews.length >= MIN_STIMULUS_SEGMENT_SESSIONS
    ) {
      const model = resolvePreferenceModel();
      const results = await Promise.all(
        fullRevealViews.map((v) =>
          classifyPreference(items, v.preferenceTail, model),
        ),
      );
      votes = results.filter((r): r is number | null => r !== undefined);
    }

    return aggregateStimulusSessions(views, items, votes);
  } catch (err) {
    console.warn(
      "[synthesis-stimuli] loader failed (continuing without stimuli):",
      err instanceof Error ? err.message : err,
    );
    return { block: null, summary: null };
  }
}

// ── Lenienter Read-Mapper (Stil normalizeSignalsSummary) ────────────────────

export function normalizeStimulusSummary(
  value: unknown,
): StimulusSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const s = value as Record<string, unknown>;
  if (s.version !== 1) return null;
  const num = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
  const items: StimulusSummaryItem[] = Array.isArray(s.items)
    ? s.items.flatMap((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry))
          return [];
        const item = entry as Record<string, unknown>;
        if (typeof item.position !== "number") return [];
        return [
          {
            position: item.position,
            label: typeof item.label === "string" ? item.label : null,
            type: typeof item.type === "string" ? item.type : "image",
            seenSessions: num(item.seenSessions),
          },
        ];
      })
    : [];
  if (items.length === 0) return null;

  let preference: StimulusPreferenceCounts | null = null;
  const p = s.preference;
  if (p && typeof p === "object" && !Array.isArray(p)) {
    const pref = p as Record<string, unknown>;
    preference = {
      counted: num(pref.counted),
      votes: Array.isArray(pref.votes)
        ? pref.votes.flatMap((entry) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry))
              return [];
            const vote = entry as Record<string, unknown>;
            if (typeof vote.position !== "number") return [];
            return [{ position: vote.position, count: num(vote.count) }];
          })
        : [],
      none: num(pref.none),
    };
  }

  return {
    version: 1,
    setSize: num(s.setSize),
    totalSessions: num(s.totalSessions),
    items,
    fullRevealSessions: num(s.fullRevealSessions),
    preference,
  };
}

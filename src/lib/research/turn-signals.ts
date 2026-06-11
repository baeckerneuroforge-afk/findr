import "server-only";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import { createResearchSupabase } from "@/lib/research/db";
import { getResearchPlan } from "@/lib/research/plans-service";
import {
  TURN_SIGNALS_VERSION,
  TurnSignalsExtractionSchema,
  type TurnSignal,
  type TurnSignalsExtraction,
  type TurnSignalsRecord,
} from "@/lib/schemas/turn-signals";
import type {
  InterviewLanguage,
  InterviewTurn,
} from "@/lib/voice-agent/interviewer";
import type { Json } from "@/types/database";

/**
 * Turn-Signale — Signal-Sidecar am Session-Ende (E1, Plan ../findr-turn-signals/
 * docs/findr-turn-signals-plan.md §4.1–§4.2). Spiegelt die Transport-Haltung
 * von market-research/classifier.ts: forced tool-use via callClaudeStructured,
 * Zod-Validierung, typed Error, KEIN heuristischer Fallback. Läuft als
 * after()-Sidecar HINTER der Teilnehmer-Response — nie im Interview-Pfad,
 * nie latenzwirksam, Fehler werden geloggt und niemals geworfen.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * RECHTSANKER — NICHT AUFWEICHEN (KI-VO Art. 3(39), Plan §3.1):
 * In diesen Klassifikator geht AUSSCHLIESSLICH der WORTLAUT des orthografischen
 * Transkripts (`conversation[].text`) plus der Plan-Titel als Kontext.
 * NIEMALS: Audio-Features, Prosodie, Timestamps, Antwort-Latenzen, Pausen,
 * Barge-in-Metriken oder sonstige Interaktions-/Verhaltensmetriken
 * (z. B. aus measurements.py des Voice-Agents). Eine Emotions-Inferenz aus
 * solchen verhaltensbiometrischen Merkmalen würde das System zum
 * „Emotionserkennungssystem" i. S. d. KI-VO machen (Hochrisiko Annex III 1(c),
 * Verbotszone Art. 5(1)(f)). Die textbasierte Auswertung hier fällt bewusst
 * NICHT darunter.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Gate-Kette des Sidecars (alle müssen halten, sonst stiller Skip):
 *   kind === 'research' UND planId vorhanden UND ≥1 Teilnehmer-Turn UND
 *   turn_signals noch null (Idempotenz) UND plan.signalsEnabled (Opt-in,
 *   default OFF) UND consent_accepted_at gesetzt (E0-Kopplung: keine
 *   Signal-Analyse ohne dokumentierte Einwilligung unter den erweiterten
 *   Consent-Texten — Sessions vor E0/Migration haben keinen Stempel und werden
 *   strukturell nie analysiert; das ist zugleich das No-Backfill-Versprechen).
 *
 * Modell: Haiku per Default (Klassifikation + Zitat-Extraktion; die Eval
 * entscheidet, ob Sonnet nötig wird). Override via SIGNALS_MODEL bzw.
 * model-Argument — Muster MARKET_RESEARCH_MODEL.
 */

export const DEFAULT_SIGNALS_MODEL = CLAUDE_MODELS.haiku;

export function resolveSignalsModel(): string {
  return process.env.SIGNALS_MODEL ?? DEFAULT_SIGNALS_MODEL;
}

export class TurnSignalsUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "TurnSignalsUnavailableError";
  }
}

export interface TurnSignalsInput {
  /** Das vollständige Transkript in Konversations-Reihenfolge — NUR role+text. */
  conversation: InterviewTurn[];
  language: InterviewLanguage;
  /** Studientitel als Analyse-Kontext (gleiche Datenlage wie Stage 1); null ok. */
  planTitle: string | null;
}

const SYSTEM_PROMPT = `You annotate research-interview transcripts with per-answer conversational signals. You are an extraction tool, not a judge of people.

YOUR ONLY INPUT IS WORDING. You read conversational affect and answer-directness from what was literally typed or transcribed — never from voice, timing, or anything outside the text.

For EVERY participant turn (and ONLY participant turns), label:

1. affect — closed vocabulary, nothing else exists:
   - enthusiasm: explicit excitement, superlatives, exclamations ("richtig gut!", "love it")
   - interest: curiosity, engaged follow-ups, voluntary elaboration
   - neutral: matter-of-fact answering — the correct DEFAULT
   - uncertainty: hedging and hesitation IN THE WORDING ("hm", "schwer zu sagen", "vielleicht", "eigentlich")
   - frustration: annoyance/irritation about the SUBJECT under discussion (product, process, price)
   - discomfort: visible unease WITH THE TOPIC of the question (deflecting phrases, "ungern", abrupt shutdowns)
2. affectIntensity: low | medium | high
3. affectEvidence: a VERBATIM, contiguous quote from THAT SAME turn carrying the affect. MANDATORY for every non-neutral affect. If you cannot point at a real quote, the affect is 'neutral' — never invent or paraphrase quotes.
4. directness — judged against the IMMEDIATELY PRECEDING interviewer question:
   - direct: the question was actually answered (short counts! "alles gut" to "wie läuft es?" is DIRECT + neutral)
   - partial: a real, nameable aspect of the question stayed unaddressed
   - evasive: topic change or pure generality instead of an answer
   - declined: the participant EXPLICITLY did not want to answer ("das möchte ich nicht sagen") — a legitimate answer, never a failure or character judgment
   A participant turn with no preceding interviewer question is 'direct'.
5. unansweredAspect: only when directness is not 'direct' — name the concrete open aspect, in the transcript's language. Otherwise null.
6. confidence: calibrated 0–1 for THIS turn's labels.

HARD RULES — these define what you are:
- NEVER produce health/clinical states (no stress, anxiety, depression), personality judgments, or honesty/deception verdicts. Not as labels, not in affectArc, not in unansweredAspect. The vocabulary above is closed.
- Brevity is NOT evasion. Content-poor but satisfied answers are direct + neutral.
- Irony and politeness formulas are traps: when unsure, choose neutral with LOW confidence. Never stretch.
- Label every participant turn exactly once, in transcript order, using the bracketed turn numbers as 'index'. Never label interviewer turns.
- affectArc: 2–3 sentences in the transcript's language describing how engagement moved across the conversation — grounded in the labeled turns, no speculation about inner states.

Sparse or fully neutral conversations legitimately yield all-neutral, all-direct labels. That is a correct result, not a failure.`;

/** Nummeriertes Transkript — `[i] INTERVIEWER:` / `[i] PARTICIPANT:`. Der
 *  Index ist die ABSOLUTE Position in conversation[]; das Modell referenziert
 *  ihn als `index`, wodurch Signale stabil adressierbar bleiben (Append-only-
 *  Invariante der Konversation). */
export function buildTurnSignalsUserPrompt(input: TurnSignalsInput): string {
  const context = input.planTitle
    ? `STUDY CONTEXT: research study "${input.planTitle}"`
    : "STUDY CONTEXT: (none provided — base your analysis solely on the transcript below)";
  const language = input.language === "de" ? "German" : "English";
  const transcript = input.conversation
    .map(
      (turn, i) =>
        `[${i}] ${turn.role === "agent" ? "INTERVIEWER" : "PARTICIPANT"}: ${turn.text}`,
    )
    .join("\n");
  return `${context}
TRANSCRIPT LANGUAGE: ${language} (write affectArc and unansweredAspect in this language)

TRANSCRIPT:
${transcript}`;
}

/**
 * Ein LLM-Call pro Session über das GESAMTE Transkript (nicht pro Turn):
 * billiger, sieht den Verlauf (Affektbogen), null Interview-Latenz. Fail-closed
 * — wirft TurnSignalsUnavailableError; der Sidecar fängt und loggt.
 */
export async function analyzeTurnSignals(
  input: TurnSignalsInput,
  model: string = resolveSignalsModel(),
): Promise<TurnSignalsExtraction> {
  try {
    return await callClaudeStructured({
      schema: TurnSignalsExtractionSchema,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildTurnSignalsUserPrompt(input) }],
      model,
      // Pro Antwort-Turn ein kompaktes Objekt (+ kurzer Bogen) — 4096 deckt
      // auch lange Interviews (Hardcap 16 Turns → ≤8 Antworten) bequem.
      maxTokens: 4096,
      timeoutMs: 120_000,
      toolName: "emit_turn_signals",
      toolDescription:
        "Return per-participant-turn conversational signals (affect with verbatim evidence, directness, confidence) plus the session affect arc. Call exactly once with ALL participant turns labeled.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      console.error(
        "[turn-signals] structured output failed twice:",
        err.message,
        "Raw:",
        err.rawResponse.slice(0, 500),
      );
      throw new TurnSignalsUnavailableError(
        "Claude turn-signal extraction returned invalid output twice",
        err,
      );
    }
    throw new TurnSignalsUnavailableError(
      "Claude turn-signal extraction failed",
      err,
    );
  }
}

// ── Server-seitige Härtung (pure, separat testbar) ──────────────────────────

/** Match-Normalisierung für die Zitat-Treue-Prüfung: typografische/gerade
 *  Anführungszeichen raus, Whitespace kollabiert, case-insensitiv. Bewusst
 *  KEINE weitergehende Fuzzy-Logik — das Zitat muss substanziell wörtlich sein. */
function normalizeForMatch(s: string): string {
  return s
    .replace(/[„“”«»‹›‘’'"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const AFFECT_ARC_MAX_CHARS = 600;

/**
 * Härtet die Modell-Extraktion zur persistierbaren TurnSignalsRecord:
 *
 *   - INDEX-VALIDIERUNG: ein Signal zählt nur, wenn sein index auf einen
 *     echten customer-Turn zeigt (Schutz gegen verschobene/erfundene Indizes);
 *     Duplikate: der erste Eintrag pro Index gewinnt.
 *   - ZITAT-TREUE (Anti-Halluzination, „ohne Zitat kein Label"): ein
 *     nicht-neutrales Affekt-Label überlebt nur, wenn affectEvidence ein
 *     wörtliches Teilzitat GENAU DIESES Turns ist (normalisiert auf
 *     Anführungszeichen/Whitespace/Case). Sonst wird das Label auf
 *     neutral/low/ohne Zitat DEGRADIERT — die Direktheit bleibt erhalten
 *     (sie braucht kein Zitat, sie vergleicht Frage und Antwort).
 *   - KONSISTENZ: unansweredAspect wird bei directness 'direct' genullt;
 *     evasiveCount/directCount werden deterministisch aus den überlebenden
 *     Turns gezählt (nie vom Modell übernommen).
 *
 * Pure Funktion — von den Unit-Tests direkt abgedeckt.
 */
export function sealTurnSignals(
  extraction: TurnSignalsExtraction,
  conversation: InterviewTurn[],
  model: string,
): TurnSignalsRecord {
  const seen = new Set<number>();
  const turns: TurnSignal[] = [];

  for (const raw of extraction.turns) {
    const source = conversation[raw.index];
    if (!source || source.role !== "customer") continue;
    if (seen.has(raw.index)) continue;
    seen.add(raw.index);

    let { affect, affectIntensity, affectEvidence } = raw;
    if (affect !== "neutral") {
      const quoteOk =
        affectEvidence !== null &&
        affectEvidence.trim() !== "" &&
        normalizeForMatch(source.text).includes(
          normalizeForMatch(affectEvidence),
        );
      if (!quoteOk) {
        affect = "neutral";
        affectIntensity = "low";
        affectEvidence = null;
      }
    } else {
      // neutral trägt kein Pflicht-Zitat; ein mitgeliefertes wird verworfen,
      // damit nie ein unbelegtes Zitat persistiert wird.
      affectEvidence = null;
    }

    turns.push({
      index: raw.index,
      affect,
      affectIntensity,
      affectEvidence,
      directness: raw.directness,
      unansweredAspect:
        raw.directness === "direct" ? null : raw.unansweredAspect,
      confidence: raw.confidence,
    });
  }

  turns.sort((a, b) => a.index - b.index);

  return {
    version: TURN_SIGNALS_VERSION,
    analyzedAt: new Date().toISOString(),
    model,
    turns,
    session: {
      affectArc: extraction.session.affectArc.trim().slice(0, AFFECT_ARC_MAX_CHARS),
      evasiveCount: turns.filter((t) => t.directness === "evasive").length,
      directCount: turns.filter((t) => t.directness === "direct").length,
    },
  };
}

// ── Sidecar (von beiden Completion-Pfaden via after() gerufen) ──────────────

/**
 * Nachgelagerte Signal-Analyse für EINE abgeschlossene Session. Läuft als
 * after()-Sidecar (Muster Post-Loss-Extraktion, session-service.ts) — die
 * Teilnehmer-Response ist zu diesem Zeitpunkt längst raus; Fehler werden
 * geloggt und NIEMALS geworfen. Lädt die Session frisch per id (konsistenter
 * Endstand nach dem finalen conversation-Write des Aufrufers).
 *
 * Pre-Migration-Verhalten (20260704000002 nicht angewandt): select("*")
 * liefert weder signals_enabled noch turn_signals → der Toggle coerced zu
 * false → der Sidecar endet still am Opt-in-Gate. Kein Log-Spam, kein Risiko.
 */
export async function runTurnSignalsSidecar(sessionId: string): Promise<void> {
  try {
    const supabase = createResearchSupabase();
    const { data, error } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) {
      console.error(
        `[turn-signals] session read failed (sidecar skipped): ${error.message}`,
      );
      return;
    }
    if (!data) return;

    if (data.kind !== "research" || !data.plan_id) return;
    const conversation =
      (data.conversation as unknown as InterviewTurn[] | null) ?? [];
    if (!conversation.some((t) => t.role === "customer")) return;

    // Idempotenz-Vorprüfung (spart den LLM-Call bei Doppel-Complete); das
    // UPDATE unten trägt zusätzlich die at-most-once-Garantie (… IS NULL).
    const existing =
      (data as { turn_signals?: unknown }).turn_signals ?? null;
    if (existing !== null) return;

    const plan = await getResearchPlan(data.org_id, data.plan_id);
    if (!plan || plan.signalsEnabled !== true) return;

    // E0-Kopplung: Signale nur mit dokumentierter Einwilligung unter den
    // erweiterten Consent-Texten (consent_accepted_at, Migration
    // 20260704000001). Bestands-Sessions ohne Stempel werden strukturell nie
    // analysiert — das ist das No-Backfill-Versprechen aus Plan §3.2.
    const consentAcceptedAt =
      (data as { consent_accepted_at?: string | null }).consent_accepted_at ??
      null;
    if (consentAcceptedAt === null) {
      console.log(
        `[turn-signals] skipped (signals_enabled, but no consent stamp): session ${sessionId}`,
      );
      return;
    }

    const model = resolveSignalsModel();
    const extraction = await analyzeTurnSignals(
      {
        conversation,
        language: data.language,
        planTitle: plan.title?.trim() || null,
      },
      model,
    );
    const record = sealTurnSignals(extraction, conversation, model);

    const { error: writeError } = await supabase
      .from("interview_sessions")
      .update({ turn_signals: record as unknown as Json })
      .eq("id", sessionId)
      .is("turn_signals", null);
    if (writeError) {
      console.error(
        `[turn-signals] persist failed (session unaffected): ${writeError.message}`,
      );
    }
  } catch (err) {
    console.error(
      "[turn-signals] sidecar failed (session unaffected):",
      err instanceof Error ? err.message : err,
    );
  }
}

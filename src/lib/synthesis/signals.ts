import "server-only";

import { createResearchSupabase } from "@/lib/research/db";
import {
  coerceTurnSignalsRecord,
  type AffectState,
} from "@/lib/schemas/turn-signals";
import { coerceConversation } from "@/lib/research/plans-service";

/**
 * E4 Synthese-Integration — Signal-/Rationale-Inputs für die Stage-2-Synthese
 * (Plan §4.7). Zwei Grundsätze, beide aus E1 geerbt:
 *
 *   1. ZAHLEN RECHNET DER SERVER, NIE DAS MODELL. Die Aggregation unten ist
 *      deterministisch; das LLM bekommt sie als Faktenblock und darf nur
 *      daraus FORMULIEREN (signal_observations). Persistiert wird der
 *      Server-Block (study_synthesis.signals_summary), die UI zeigt Zahlen
 *      ausschließlich von dort — ein LLM-Zahlendreher kann nie eine Kennzahl
 *      werden.
 *
 *   2. MINDEST-N (Plan §4.7/§7): Aggregat-Aussagen über Signale erst ab
 *      MIN_SIGNAL_AGGREGATE_SESSIONS Sessions mit Signal-Befund. Darunter
 *      liefert der Loader null → kein Faktenblock im Prompt, keine
 *      signal_observations, kein signals_summary. Einzel-Session-Signale
 *      bleiben in der Transkript-Ansicht (E2) sichtbar — nur die
 *      AGGREGATION braucht das Mindest-N.
 *
 * Kostenhaltung (Engine-Guardrail „nie Roh-Transkripte in den Prompt"):
 * geladen werden conversation + turn_signals zwar zeilenweise aus der DB,
 * in den PROMPT reisen aber nur die abgeleiteten Kompakt-Blöcke — Zählwerte,
 * offene Aspekte und die kurzen WHY-Sätze (E3, ≤300 Zeichen), nie der
 * Gesprächstext.
 */

export const MIN_SIGNAL_AGGREGATE_SESSIONS = 3;
/** Obergrenze der betrachteten Sessions (Spiegel von SESSION_LIST_LIMIT). */
const SIGNAL_SESSION_LIMIT = 50;
/** Cap der „offen geblieben"-Aspekte im Faktenblock (Token-Hygiene). */
const MAX_OPEN_ASPECTS = 20;
/** Cap der Rationales pro Session im Prompt (Interviews sind ≤8 Fragen). */
const MAX_RATIONALES_PER_SESSION = 10;

export interface SignalsSummary {
  version: 1;
  /** Abgeschlossene Research-Sessions des Plans (Betrachtungsmenge). */
  totalSessions: number;
  /** Davon mit Turn-Signal-Befund (E1-Sidecar gelaufen). */
  signalSessions: number;
  /** Antwort-Zählungen über alle Signal-Sessions (deterministisch). */
  totalAnswers: number;
  direct: number;
  partial: number;
  evasive: number;
  declined: number;
  /** Non-neutrale Affekt-Zählungen (neutral ist Default, keine Kennzahl). */
  affects: Partial<Record<Exclude<AffectState, "neutral">, number>>;
  /** Sessions mit ≥1 WHY-Rationale (E3) — Coverage für die Methodik. */
  whySessions: number;
}

/** Faktenblock für den Prompt — SignalsSummary + die offenen Frage-Aspekte
 *  aus nicht-direkten Antworten (thematisches Rohmaterial für Beobachtungen). */
export interface SignalsPromptBlock {
  summary: SignalsSummary;
  openAspects: string[];
}

/** WHY-Rationales einer Session, in Frage-Reihenfolge; Label ist ein
 *  anonymer Kurzname (S1, S2, …) — Session-UUIDs haben im Prompt nichts
 *  verloren und die Methodik aggregiert ohnehin thematisch. */
export interface SessionRationales {
  sessionLabel: string;
  rationales: string[];
}

export interface SynthesisSignalInputs {
  signals: SignalsPromptBlock | null;
  rationales: SessionRationales[] | null;
  /** Für die Coverage-Note: Sessions gesamt vs. mit Rationales. */
  rationaleCoverage: { withRationales: number; totalSessions: number } | null;
}

/** Zeilenform, die der Aggregator konsumiert — pure & test-direkt befüllbar. */
export interface SignalSessionRow {
  turnSignals: ReturnType<typeof coerceTurnSignalsRecord>;
  whys: string[];
}

/**
 * Pure Aggregation (exported for unit tests): rechnet den deterministischen
 * Faktenblock aus den geladenen Session-Zeilen. Gibt null zurück, wenn das
 * Mindest-N nicht erreicht ist — der Aufrufer lässt dann JEDEN Signal-Anteil
 * (Promptblock, signal_observations, signals_summary) weg.
 */
export function aggregateSignalSessions(
  rows: SignalSessionRow[],
): SynthesisSignalInputs {
  const totalSessions = rows.length;
  const withSignals = rows.filter(
    (r) => r.turnSignals !== null && r.turnSignals.turns.length > 0,
  );
  const withWhys = rows.filter((r) => r.whys.length > 0);

  // Rationales sind vom Mindest-N unabhängig: die Methodik beschreibt die
  // INTERVIEWFÜHRUNG (keine Aussagen über Personen[gruppen]) — schon eine
  // einzige Session mit echten Begründungen trägt einen ehrlichen Abschnitt.
  const rationales: SessionRationales[] | null =
    withWhys.length === 0
      ? null
      : rows
          .map((r, i) => ({
            sessionLabel: `S${i + 1}`,
            rationales: r.whys.slice(0, MAX_RATIONALES_PER_SESSION),
          }))
          .filter((r) => r.rationales.length > 0);

  const rationaleCoverage =
    rationales === null
      ? null
      : { withRationales: withWhys.length, totalSessions };

  if (withSignals.length < MIN_SIGNAL_AGGREGATE_SESSIONS) {
    return { signals: null, rationales, rationaleCoverage };
  }

  const summary: SignalsSummary = {
    version: 1,
    totalSessions,
    signalSessions: withSignals.length,
    totalAnswers: 0,
    direct: 0,
    partial: 0,
    evasive: 0,
    declined: 0,
    affects: {},
    whySessions: withWhys.length,
  };
  const openAspects: string[] = [];

  for (const row of withSignals) {
    const record = row.turnSignals;
    if (!record) continue;
    for (const turn of record.turns) {
      summary.totalAnswers += 1;
      summary[turn.directness] += 1;
      if (turn.affect !== "neutral") {
        summary.affects[turn.affect] =
          (summary.affects[turn.affect] ?? 0) + 1;
      }
      if (
        turn.directness !== "direct" &&
        turn.unansweredAspect &&
        openAspects.length < MAX_OPEN_ASPECTS
      ) {
        openAspects.push(turn.unansweredAspect);
      }
    }
  }

  return {
    signals: { summary, openAspects },
    rationales,
    rationaleCoverage,
  };
}

/**
 * DB-Loader: abgeschlossene Research-Sessions des Plans (org+plan-scoped,
 * Cap 50, älteste zuerst — stabile S1…Sn-Labels) → Aggregat + Rationales.
 * Fail-open: jeder Lesefehler ergibt „keine Signal-Inputs", nie einen
 * Synthese-Abbruch — die Kern-Synthese ist von E4 unberührbar.
 */
export async function loadSynthesisSignalInputs(
  orgId: string,
  planId: string,
): Promise<SynthesisSignalInputs> {
  try {
    const supabase = createResearchSupabase();
    const { data, error } = await supabase
      .from("interview_sessions")
      .select("id, conversation, turn_signals, created_at")
      .eq("org_id", orgId)
      .eq("plan_id", planId)
      .eq("kind", "research")
      .eq("status", "completed")
      .order("created_at", { ascending: true })
      .limit(SIGNAL_SESSION_LIMIT);
    if (error || !data) {
      if (error) {
        console.warn(
          `[synthesis-signals] session read failed (continuing without signals): ${error.message}`,
        );
      }
      return { signals: null, rationales: null, rationaleCoverage: null };
    }
    const rows: SignalSessionRow[] = data.map((row) => ({
      turnSignals: coerceTurnSignalsRecord(
        (row as { turn_signals?: unknown }).turn_signals,
      ),
      whys: coerceConversation(row.conversation)
        .filter((t) => t.role === "agent" && typeof t.why === "string")
        .map((t) => t.why as string),
    }));
    return aggregateSignalSessions(rows);
  } catch (err) {
    console.warn(
      "[synthesis-signals] loader failed (continuing without signals):",
      err instanceof Error ? err.message : err,
    );
    return { signals: null, rationales: null, rationaleCoverage: null };
  }
}

/** Lenienter Read-Mapper für die persistierte signals_summary (Stil
 *  normalizeEmergentThemes): nur eine wohlgeformte v1 kommt durch. */
export function normalizeSignalsSummary(value: unknown): SignalsSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const s = value as Record<string, unknown>;
  if (s.version !== 1) return null;
  const num = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
  const affects: SignalsSummary["affects"] = {};
  if (s.affects && typeof s.affects === "object" && !Array.isArray(s.affects)) {
    for (const [k, v] of Object.entries(s.affects as Record<string, unknown>)) {
      if (
        ["enthusiasm", "interest", "uncertainty", "frustration", "discomfort"].includes(k)
      ) {
        affects[k as Exclude<AffectState, "neutral">] = num(v);
      }
    }
  }
  return {
    version: 1,
    totalSessions: num(s.totalSessions),
    signalSessions: num(s.signalSessions),
    totalAnswers: num(s.totalAnswers),
    direct: num(s.direct),
    partial: num(s.partial),
    evasive: num(s.evasive),
    declined: num(s.declined),
    affects,
    whySessions: num(s.whySessions),
  };
}

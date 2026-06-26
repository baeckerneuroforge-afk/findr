import "server-only";

import type { Json } from "@/types/database";
import {
  createResearchSupabase,
  type KonsoulThreadTurn,
} from "@/lib/research/db";

/**
 * Konsoul P5 — PERSISTED THREADS service (Roadmap P5). Org-scoped read/write of
 * the „Frag Konsoul" conversation so it survives a reload.
 *
 * ─── HARTE LEITPLANKEN ──────────────────────────────────────────────────────
 * - ORG-AUTORITATIV. `orgId` kommt vom Aufrufer (requireOrgIdOrError-Route), NIE
 *   vom Client/Modell. Jeder Read/Write/Delete ist per `.eq('org_id', orgId)`
 *   org-scoped (zusätzlich zur RLS) — ein erratener Thread fremder Org trifft nie.
 * - NUR {role, content}-TEXT. `sanitizeTurns` wirft jedes Feld außer role+content
 *   weg (KEINE citations, KEIN result-Envelope, KEINE Zahlen-Blöcke — Zahlen
 *   werden beim Weiterführen frisch + deterministisch neu berechnet, der Honesty-
 *   Vertrag bleibt; ein persistiertes Zitat würde sonst veralten/lügen). Caps auf
 *   Turn-Anzahl + content-Länge halten die Tabelle beschränkt.
 * - FAIL-OPEN beim Speichern: ein Persist-Fehler darf die bereits gelieferte
 *   Antwort NIE entwerten → `saveThread` gibt bei Fehler `{ threadId: null }`
 *   zurück, statt zu werfen.
 */

/** Höchstens so viele Turns je Thread (≈20 Frage/Antwort-Runden). */
export const MAX_THREAD_TURNS = 40;
/** Höchstlänge je Turn-content (deckt sich mit dem History-Schema-Cap). */
export const MAX_TURN_CONTENT = 4000;
/** Höchstlänge des abgeleiteten Titels (nur Listen-Beschriftung). */
export const MAX_THREAD_TITLE = 120;

export interface ThreadSummary {
  id: string;
  title: string | null;
  updatedAt: string;
  turnCount: number;
}

/**
 * Pure: koerziert beliebigen jsonb/Client-Input in eine saubere, gekappte
 * {role, content}-Liste. Verwirft alles Fremde (Nicht-Objekte, falsche Rollen,
 * leere/Nicht-String-content) und behält die LETZTEN MAX_THREAD_TURNS.
 */
export function sanitizeTurns(raw: unknown): KonsoulThreadTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: KonsoulThreadTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const role = rec.role;
    const content = rec.content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.trim();
    if (trimmed.length === 0) continue;
    out.push({ role, content: trimmed.slice(0, MAX_TURN_CONTENT) });
  }
  // Nur die jüngsten Turns behalten (deckelt Tabellen-/Prompt-Größe).
  return out.slice(-MAX_THREAD_TURNS);
}

/** Titel = erste Nutzer-Frage, gekappt. Null, wenn keine vorhanden. */
function deriveTitle(turns: KonsoulThreadTurn[]): string | null {
  const firstUser = turns.find((t) => t.role === "user");
  if (!firstUser) return null;
  return firstUser.content.slice(0, MAX_THREAD_TITLE);
}

function reportThreadFailure(context: string, err: unknown): void {
  try {
    const g = globalThis as {
      Sentry?: { captureException?: (e: unknown) => void };
    };
    if (g.Sentry?.captureException) g.Sentry.captureException(err);
  } catch {
    // never let the logger throw
  }
  console.error(`[konsoul-threads] ${context}:`, err);
}

export interface SaveThreadInput {
  /** org-autoritativ — NIE vom Client. */
  orgId: string;
  /** Vorhandener Thread (Weiterführen) oder undefined (neu anlegen). */
  threadId?: string | null;
  /** Voller Verlauf — wird sanitisiert + gekappt vor dem Write. */
  turns: unknown;
}

export interface SaveThreadResult {
  /** Effektive Thread-ID (vorhandene bei Update, neue bei Insert) oder null bei
   *  fail-open (Schreibfehler / nichts zu speichern). */
  threadId: string | null;
  created: boolean;
  /** Anzahl der TATSÄCHLICH persistierten Turns (nach sanitizeTurns-Kappung) —
   *  damit die Telemetrie die Zeilen-Realität zählt, nicht die rohe Client-Länge. */
  turnCount: number;
}

/**
 * Speichert den Verlauf. Vorhandener (org-eigener) threadId ⇒ Update; sonst (oder
 * fremder/veralteter threadId, der 0 Zeilen trifft) ⇒ Insert mit neuer ID. Leerer
 * sanitisierter Verlauf ⇒ kein Write. Fail-open: bei Fehler `{ threadId: null }`.
 */
export async function saveThread(
  input: SaveThreadInput,
): Promise<SaveThreadResult> {
  const turns = sanitizeTurns(input.turns);
  if (turns.length === 0) return { threadId: null, created: false, turnCount: 0 };
  const title = deriveTitle(turns);
  const turnsJson = turns as unknown as Json;

  try {
    const supabase = createResearchSupabase();

    if (input.threadId) {
      const { data, error } = await supabase
        .from("konsoul_threads")
        .update({
          turns: turnsJson,
          title,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.threadId)
        .eq("org_id", input.orgId)
        .select("id")
        .maybeSingle();
      if (error) {
        reportThreadFailure("update failed", error);
        return { threadId: null, created: false, turnCount: 0 };
      }
      if (data)
        return { threadId: data.id, created: false, turnCount: turns.length };
      // threadId unbekannt / fremde Org → als neuen Thread anlegen (kein Leak).
    }

    const { data, error } = await supabase
      .from("konsoul_threads")
      .insert({ org_id: input.orgId, title, turns: turnsJson })
      .select("id")
      .single();
    if (error || !data) {
      reportThreadFailure("insert failed", error ?? "no row");
      return { threadId: null, created: false, turnCount: 0 };
    }
    return { threadId: data.id, created: true, turnCount: turns.length };
  } catch (err) {
    reportThreadFailure("saveThread threw", err);
    return { threadId: null, created: false, turnCount: 0 };
  }
}

/** Liste der jüngsten Threads der Org (für „Letzte Gespräche"). Fail-open: []. */
export async function listThreads(
  orgId: string,
  limit = 30,
): Promise<ThreadSummary[]> {
  try {
    const supabase = createResearchSupabase();
    const { data, error } = await supabase
      .from("konsoul_threads")
      .select("id, title, updated_at, turns")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100));
    if (error || !data) {
      if (error) reportThreadFailure("list failed", error);
      return [];
    }
    return data.map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updated_at,
      turnCount: sanitizeTurns(row.turns).length,
    }));
  } catch (err) {
    reportThreadFailure("listThreads threw", err);
    return [];
  }
}

/** Lädt die Turns EINES org-eigenen Threads. Null, wenn nicht gefunden/fremd. */
export async function loadThread(
  orgId: string,
  threadId: string,
): Promise<KonsoulThreadTurn[] | null> {
  try {
    const supabase = createResearchSupabase();
    const { data, error } = await supabase
      .from("konsoul_threads")
      .select("turns")
      .eq("id", threadId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (error) {
      reportThreadFailure("load failed", error);
      return null;
    }
    if (!data) return null;
    return sanitizeTurns(data.turns);
  } catch (err) {
    reportThreadFailure("loadThread threw", err);
    return null;
  }
}

/** Löscht einen org-eigenen Thread. True bei Erfolg. */
export async function deleteThread(
  orgId: string,
  threadId: string,
): Promise<boolean> {
  try {
    const supabase = createResearchSupabase();
    const { error } = await supabase
      .from("konsoul_threads")
      .delete()
      .eq("id", threadId)
      .eq("org_id", orgId);
    if (error) {
      reportThreadFailure("delete failed", error);
      return false;
    }
    return true;
  } catch (err) {
    reportThreadFailure("deleteThread threw", err);
    return false;
  }
}

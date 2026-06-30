import "server-only";

import type { Json } from "@/types/database";
import type {
  TaskResult,
  TaskResultFrictionEvent,
} from "@/lib/schemas/task-result";

import { createResearchSupabase, type ResearchSessionEventType } from "./db";

// Re-exported so existing importers of these types keep working; the canonical
// definition + Zod schema + read-mapper live in @/lib/schemas/task-result.
export type { TaskResult, TaskResultFrictionEvent };

/**
 * Phase 2b — behavioural usability EVENT STORE (integration plan §5, L5/L6/L8).
 *
 * Ingests the small batches of interaction events a participant produces during a
 * usability task and derives a SERVER-COMPUTED task result from them. The numbers
 * are computed here, deterministically — never by an LLM (same discipline as the
 * E4/E7 signal/stimulus aggregation: "Zahlen rechnet der Server, nie das Modell").
 *
 * STRUCTURAL RED LINE (integration plan L8): friction is derived ONLY from
 * behaviour (click runs, timing). There is NO voice/face/webcam channel and NO
 * affect/emotion field anywhere in this module. Do NOT add one — it would push
 * the product into AI-Act Annex-III high-risk territory.
 */

// ── Session resolution ───────────────────────────────────────────────────────

export interface EventSessionRow {
  id: string;
  org_id: string;
  kind: string;
  status: string;
  plan_id: string | null;
  // Phase-2a per-tier consent stamps live on interview_sessions; assertCaptureConsent
  // reads them. Carried through so the route can gate without a second read.
  events_consent_at?: string | null;
  replay_consent_at?: string | null;
  screen_consent_at?: string | null;
}

export type ResolveResearchEventSessionResult =
  | { ok: true; session: EventSessionRow }
  | { ok: false; reason: "not_found" | "wrong_kind" | "ineligible" };

/**
 * Resolve the token-owned interview session for an event batch. Mirrors
 * resolveVisualCaptureSession, with one deliberate difference: events stream
 * DURING the interview, so an 'open' session is the normal case (visual capture
 * runs post-completion). 'completed' is also accepted for a final flush;
 * anything else (e.g. abandoned) is ineligible.
 */
export async function resolveResearchEventSession(
  accessToken: string,
): Promise<ResolveResearchEventSessionResult> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("access_token", accessToken)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read interview session: ${error.message}`);
  }
  if (!data) {
    return { ok: false, reason: "not_found" };
  }
  const row = data as unknown as {
    kind?: string;
    status?: string;
  } & EventSessionRow;
  if (row.kind !== "research") {
    return { ok: false, reason: "wrong_kind" };
  }
  if (row.status !== "open" && row.status !== "completed") {
    return { ok: false, reason: "ineligible" };
  }
  return { ok: true, session: row };
}

// ── Task-result computation (pure, server-authoritative) ─────────────────────

export interface ComputeEventInput {
  event_type: ResearchSessionEventType | string;
  ts_ms: number;
}

const RAGE_CLICK_WINDOW_MS = 1000;
const RAGE_CLICK_MIN_RUN = 3;

/**
 * Derive the task result from the full behavioural event set of one session.
 * Pure and deterministic — no I/O, no clock, no model. Behavioural only.
 *
 * - success: decided by the LAST terminal event (task_complete → true,
 *   task_abandon → false). null = still in progress / no terminal event.
 * - time_on_task_seconds: first task_start (or first event) → terminal event
 *   (or last event). ts_ms is client-supplied, so a negative span clamps to 0.
 * - click_count: 'click' events within the task window (up to the terminal event).
 * - friction_events: ONE entry per rage-click RUN — a maximal chain of
 *   consecutive clicks each < RAGE_CLICK_WINDOW_MS apart that reaches
 *   RAGE_CLICK_MIN_RUN clicks. ts_ms = the run's first click. So the array
 *   LENGTH is the count of rage bursts. NOT an affect label; behaviour only (L8).
 */
export function computeTaskResult(events: ComputeEventInput[]): TaskResult {
  const sorted = [...events].sort((a, b) => a.ts_ms - b.ts_ms);

  let success: boolean | null = null;
  for (const e of sorted) {
    if (e.event_type === "task_complete") success = true;
    else if (e.event_type === "task_abandon") success = false;
  }

  const start =
    sorted.find((e) => e.event_type === "task_start") ?? sorted[0] ?? null;
  // The LAST terminal event is authoritative; if none, the task is still in
  // progress and the whole (sorted) history is in scope.
  const terminalIdx = (() => {
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (
        sorted[i].event_type === "task_complete" ||
        sorted[i].event_type === "task_abandon"
      )
        return i;
    }
    return -1;
  })();
  const terminal =
    terminalIdx >= 0 ? sorted[terminalIdx] : (sorted[sorted.length - 1] ?? null);
  const time_on_task_seconds =
    start && terminal
      ? Math.max(0, Math.round((terminal.ts_ms - start.ts_ms) / 1000))
      : null;

  // ONE measurement window: every derived metric (clicks + friction) is scoped
  // to the task window — up to and including the authoritative terminal event.
  // Clicks AFTER "done"/"abandon" (the control fires while listeners are still
  // attached) are not part of THIS task's behaviour. With no terminal, the task
  // is in progress and all clicks count (unchanged).
  const inScope = terminalIdx >= 0 ? sorted.slice(0, terminalIdx + 1) : sorted;
  const clicks = inScope.filter((e) => e.event_type === "click");

  // ONE friction_event per rage-click RUN, not per click that closes a run.
  // A run = a maximal chain of consecutive clicks whose every gap is
  // < RAGE_CLICK_WINDOW_MS; it is flagged once when it reaches
  // RAGE_CLICK_MIN_RUN clicks. ts_ms = the run's FIRST click (when the friction
  // began). So friction_events.length is the count of rage-click bursts the
  // participant produced — what the judge prompt and the card mean.
  const friction_events: TaskResultFrictionEvent[] = [];
  let runStart = 0;
  let runLen = 0;
  for (let i = 0; i < clicks.length; i++) {
    if (i > 0 && clicks[i].ts_ms - clicks[i - 1].ts_ms < RAGE_CLICK_WINDOW_MS) {
      runLen++;
    } else {
      runStart = i;
      runLen = 1;
    }
    if (runLen === RAGE_CLICK_MIN_RUN) {
      friction_events.push({
        type: "rage_click",
        ts_ms: clicks[runStart].ts_ms,
      });
    }
  }

  return {
    version: 1,
    success,
    time_on_task_seconds,
    click_count: clicks.length,
    friction_events,
  };
}

// ── Ingest ───────────────────────────────────────────────────────────────────

export interface IngestEventInput {
  event_type: ResearchSessionEventType;
  ts_ms: number;
  target_selector?: string | null;
  payload?: unknown;
}

export interface IngestSessionEventsResult {
  eventCount: number;
  taskResult: TaskResult;
}

/**
 * Persist a batch of events for a session, then recompute and store the
 * task_result from ALL of the session's events (the new batch + everything
 * already stored), so the stored result is always server-authoritative and
 * monotonic with the full history. Every write is scoped to (id, org_id).
 */
export async function ingestSessionEvents(params: {
  session: EventSessionRow;
  events: IngestEventInput[];
}): Promise<IngestSessionEventsResult> {
  const { session, events } = params;
  const supabase = createResearchSupabase();

  const rows = events.map((e) => ({
    session_id: session.id,
    org_id: session.org_id,
    event_type: e.event_type,
    ts_ms: e.ts_ms,
    target_selector: e.target_selector ?? null,
    payload: (e.payload ?? {}) as Json,
  }));

  const { error: insertError } = await supabase
    .from("research_session_events")
    .insert(rows);
  if (insertError) {
    throw new Error(`Failed to persist events: ${insertError.message}`);
  }

  const { data: all, error: readError } = await supabase
    .from("research_session_events")
    .select("event_type, ts_ms")
    .eq("session_id", session.id)
    .eq("org_id", session.org_id);
  if (readError) {
    throw new Error(`Failed to read events: ${readError.message}`);
  }

  const taskResult = computeTaskResult(
    (all ?? []).map((r) => ({ event_type: r.event_type, ts_ms: r.ts_ms })),
  );

  const { error: writeError } = await supabase
    .from("interview_sessions")
    .update({ task_result: taskResult as unknown as Json })
    .eq("id", session.id)
    .eq("org_id", session.org_id);
  if (writeError) {
    throw new Error(`Failed to store task result: ${writeError.message}`);
  }

  return { eventCount: rows.length, taskResult };
}

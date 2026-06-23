"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Phase 2c — client-side behavioural event collector for the participant
 * interview. Captures NON-biometric DOM interactions (clicks, scroll, form
 * focus/blur) plus the task lifecycle (start / complete / abandon) and batches
 * them to POST /api/interview/[token]/events, which fail-closes on the per-study
 * event-tracking flag AND the participant's "events" consent tier.
 *
 * STRUCTURAL RED LINE (integration plan L8): behavioural only. We send the event
 * type, a relative timestamp, and a SHORT structural selector (tag / id /
 * first-class, truncated) — never element text, input values, audio, video or
 * any affect signal. The server route additionally rejects value/text payload
 * keys.
 *
 * `active` gates EVERYTHING: without events-tier consent the caller passes
 * active=false and not a single listener is attached or request sent.
 */

type CollectedEventType =
  | "click"
  | "scroll"
  | "input_focus"
  | "input_blur"
  | "task_start"
  | "task_complete"
  | "task_abandon";

interface CollectedEvent {
  event_type: CollectedEventType;
  ts_ms: number;
  target_selector?: string;
}

const FLUSH_INTERVAL_MS = 5000;
const FLUSH_AT_COUNT = 40;
const MAX_BUFFER = 2000;
const SCROLL_THROTTLE_MS = 1000;
const MAX_SELECTOR_LEN = 120;

/** A short, NON-PII structural selector: tag + (#id | .first-class), capped.
 *  Never element text or attribute values. */
function shortSelector(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) return undefined;
  const tag = target.tagName.toLowerCase();
  const id = typeof target.id === "string" && target.id ? `#${target.id}` : "";
  const cls =
    !id &&
    typeof target.className === "string" &&
    target.className.trim() !== ""
      ? `.${target.className.trim().split(/\s+/)[0]}`
      : "";
  return `${tag}${id}${cls}`.slice(0, MAX_SELECTOR_LEN);
}

function isFormField(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

export function useEventCollector({
  token,
  active,
  completed,
}: {
  token: string;
  active: boolean;
  completed: boolean;
}): void {
  const bufferRef = useRef<CollectedEvent[]>([]);
  const startEpochRef = useRef(0);
  const startedRef = useRef(false);
  const completedSentRef = useRef(false);

  const flush = useCallback(
    (keepalive = false) => {
      if (bufferRef.current.length === 0) return;
      const events = bufferRef.current.splice(0, bufferRef.current.length);
      void fetch(`/api/interview/${token}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
        keepalive,
      }).catch(() => {
        // Best-effort: the server route is the authoritative store. A dropped
        // batch only means those events are not analysed; it never blocks the UI.
      });
    },
    [token],
  );

  const push = useCallback(
    (event_type: CollectedEventType, target_selector?: string) => {
      if (bufferRef.current.length >= MAX_BUFFER) return;
      const ts_ms = startEpochRef.current
        ? Math.max(0, Math.round(Date.now() - startEpochRef.current))
        : 0;
      bufferRef.current.push({
        event_type,
        ts_ms,
        ...(target_selector ? { target_selector } : {}),
      });
      if (bufferRef.current.length >= FLUSH_AT_COUNT) flush();
    },
    [flush],
  );

  // Listener lifetime tracks `active`. Attaches ONLY with events-tier consent.
  useEffect(() => {
    if (!active) return;
    if (!startedRef.current) {
      startedRef.current = true;
      startEpochRef.current = Date.now();
      push("task_start");
    }

    let lastScroll = 0;
    const onClick = (e: Event) => push("click", shortSelector(e.target));
    const onScroll = () => {
      const now = Date.now();
      if (now - lastScroll < SCROLL_THROTTLE_MS) return;
      lastScroll = now;
      push("scroll");
    };
    const onFocusIn = (e: Event) => {
      if (isFormField(e.target)) push("input_focus", shortSelector(e.target));
    };
    const onFocusOut = (e: Event) => {
      if (isFormField(e.target)) push("input_blur", shortSelector(e.target));
    };
    const onPageHide = () => {
      if (!completedSentRef.current) push("task_abandon");
      flush(true);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("pagehide", onPageHide);
    const interval = window.setInterval(() => flush(), FLUSH_INTERVAL_MS);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(interval);
      flush();
    };
  }, [active, flush, push]);

  // Task completion → one terminal task_complete + a final flush.
  useEffect(() => {
    if (!active || !completed || completedSentRef.current) return;
    completedSentRef.current = true;
    push("task_complete");
    flush();
  }, [active, completed, flush, push]);
}

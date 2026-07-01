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
 * type, an epoch timestamp, and a SHORT structural selector (tag / id /
 * first-class, truncated) — never element text, input values, audio, video or
 * any affect signal. The server route additionally rejects value/text payload
 * keys.
 *
 * `active` gates EVERYTHING: without events-tier consent the caller passes
 * active=false and not a single listener is attached or request sent.
 *
 * ── MESS-EHRLICHKEIT (UX-Engine-Fixes 2026-07-02, Befunde B1/B3/B4) ─────────
 *
 * B1 — Task-Surface-Scoping: Wo die Interaktions-Listener hängen, hängt von
 * `mode` ab. Vorher hingen sie IMMER am Dokument der Interview-Seite — bei
 * einem Prototyp im neuen Tab zählten click_count/„Rage-Clicks" also Klicks
 * ins Chat-UI, nicht ins Testobjekt.
 *   "page"     → Aufgabe findet auf der Interview-Seite selbst statt (kein
 *                targetUrl / kein Task): Seiten-Listener + auto task_start bei
 *                Aktivierung — das alte Verhalten, dort ist es korrekt.
 *   "embed"    → first-party iframe: Listener hängen NUR am (same-origin)
 *                iframe-Dokument (`surfaceDoc`, vom Aufrufer aus onLoad
 *                gereicht). Cross-origin (contentDocument unzugänglich) →
 *                surfaceDoc bleibt null → nur Lifecycle-Events, keine
 *                erfundenen Klick-Zahlen.
 *   "external" → Prototyp im neuen Tab: dort können wir strukturell nichts
 *                messen → KEINE click/scroll/focus-Listener; es zählt nur der
 *                Lifecycle (task_start über den Link-Klick via
 *                markTaskStarted, Ausgang über declareOutcome).
 *
 * B3 — Kein Auto-Ausgang mehr: Früher stempelte das Interview-Ende automatisch
 * task_complete (und pagehide task_abandon) — jede abgeschlossene Session ohne
 * explizite Erklärung zählte als „geschafft" (systematischer Erfolgs-Bias im
 * Aggregat). Jetzt entsteht ein Terminal-Event AUSSCHLIESSLICH über
 * declareOutcome (die „Geschafft / Nicht geschafft"-Buttons). Ohne Erklärung
 * bleibt success=null → „offen"/indeterminate; das Aggregat rechnet die Rate
 * ohnehin nur über determinierte Ausgänge.
 *
 * B4 — Epoch-Timestamps: ts_ms war relativ zum Collector-Start; nach einem
 * Seiten-Reload begann die Uhr wieder bei 0 und der Server (der ALLE Events
 * einer Session nach ts_ms sortiert) verwob zwei Läufe chronologisch falsch.
 * Jetzt ist ts_ms Date.now() (Epoch) — reload-stabil geordnet; der Server
 * rechnet ausschließlich Differenzen (MAX_TS_MS lässt Epoch explizit zu).
 */

type CollectedEventType =
  | "click"
  | "scroll"
  | "input_focus"
  | "input_blur"
  | "task_start"
  | "task_complete"
  | "task_abandon";

export type TaskSurfaceMode = "page" | "embed" | "external";

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
  mode = "page",
  surfaceDoc = null,
}: {
  token: string;
  active: boolean;
  /** B1 — wo die Aufgabe stattfindet (siehe Modul-Doku). Default "page" =
   *  Alt-Verhalten für Studien ohne Prototyp-URL. */
  mode?: TaskSurfaceMode;
  /** B1 — same-origin Dokument des first-party iframes (Aufrufer setzt es aus
   *  iframe.onLoad; cross-origin → null). Nur in mode="embed" relevant. */
  surfaceDoc?: Document | null;
}): {
  declareOutcome: (outcome: "complete" | "abandon") => void;
  /** B1 — expliziter Task-Beginn (Klick auf den Prototyp-Link). Idempotent. */
  markTaskStarted: () => void;
} {
  const bufferRef = useRef<CollectedEvent[]>([]);
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
      // Terminal events carry the AUTHORITATIVE task outcome (computeTaskResult
      // decides success from the LAST task_complete/task_abandon). Dropping one
      // under buffer pressure would silently lose the outcome and leave
      // success=null. So MAX_BUFFER backpressure sheds only noise events;
      // terminals are always enqueued. completedSentRef still guarantees AT MOST
      // ONE terminal is ever pushed, so this adds at most a row or two past the cap.
      const isTerminal =
        event_type === "task_complete" || event_type === "task_abandon";
      if (!isTerminal && bufferRef.current.length >= MAX_BUFFER) return;
      bufferRef.current.push({
        event_type,
        // B4 — Epoch-ms: reload-stabile globale Ordnung; der Server rechnet
        // nur Differenzen und toleriert Epoch per MAX_TS_MS ausdrücklich.
        ts_ms: Date.now(),
        ...(target_selector ? { target_selector } : {}),
      });
      if (bufferRef.current.length >= FLUSH_AT_COUNT) flush();
    },
    [flush],
  );

  const markTaskStarted = useCallback(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;
    push("task_start");
    flush();
  }, [active, push, flush]);

  // Flush-Takt + pagehide-Final-Flush laufen in JEDEM Modus, sobald aktiv.
  // B3: pagehide sendet KEIN task_abandon mehr — Tab-Wechsel zum Prototyp oder
  // Schließen nach dem Interview sind kein erklärter Misserfolg; ohne
  // explizite Erklärung bleibt der Ausgang „offen".
  useEffect(() => {
    if (!active) return;

    // mode="page": die Interview-Seite IST die Aufgabenfläche → Task beginnt
    // mit der Erfassung (Alt-Verhalten, korrekt für Aufgaben ohne Prototyp).
    if (mode === "page" && !startedRef.current) {
      startedRef.current = true;
      push("task_start");
    }

    const onPageHide = () => flush(true);
    window.addEventListener("pagehide", onPageHide);
    const interval = window.setInterval(() => flush(), FLUSH_INTERVAL_MS);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(interval);
      flush();
    };
  }, [active, mode, flush, push]);

  // B1 — Interaktions-Listener am richtigen Dokument:
  //   page  → Interview-Seite (document)
  //   embed → same-origin iframe-Dokument (surfaceDoc); null → nichts
  //   external → nichts (dort ist strukturell nichts messbar)
  useEffect(() => {
    if (!active) return;
    const target: Document | null =
      mode === "page" ? document : mode === "embed" ? surfaceDoc : null;
    if (!target) return;

    // Erste echte Interaktion mit dem eingebetteten Prototyp = Task-Beginn
    // (falls der Teilnehmer nicht vorher den Fallback-Link geklickt hat).
    const ensureStarted = () => {
      if (!startedRef.current) {
        startedRef.current = true;
        push("task_start");
      }
    };

    let lastScroll = 0;
    const onClick = (e: Event) => {
      ensureStarted();
      push("click", shortSelector(e.target));
    };
    const onScroll = () => {
      const now = Date.now();
      if (now - lastScroll < SCROLL_THROTTLE_MS) return;
      lastScroll = now;
      ensureStarted();
      push("scroll");
    };
    const onFocusIn = (e: Event) => {
      if (isFormField(e.target)) {
        ensureStarted();
        push("input_focus", shortSelector(e.target));
      }
    };
    const onFocusOut = (e: Event) => {
      if (isFormField(e.target)) push("input_blur", shortSelector(e.target));
    };

    const scrollTarget: Document | Window =
      mode === "page" ? window : target;
    target.addEventListener("click", onClick, true);
    scrollTarget.addEventListener("scroll", onScroll, true);
    target.addEventListener("focusin", onFocusIn);
    target.addEventListener("focusout", onFocusOut);

    return () => {
      target.removeEventListener("click", onClick, true);
      scrollTarget.removeEventListener("scroll", onScroll, true);
      target.removeEventListener("focusin", onFocusIn);
      target.removeEventListener("focusout", onFocusOut);
    };
  }, [active, mode, surfaceDoc, push]);

  // Phase 1b — explicit participant task outcome (the "Aufgabe geschafft /
  // nicht geschafft" control). This is the ONLY terminal signal (B3): a
  // behavioural fact the participant declares, NOT a model verdict and NOT ein
  // Auto-Stempel des Interview-Endes. Fehlt vor dem Terminal ein task_start
  // (external-Modus, Link nie geklickt), wird er nachgeholt, damit die
  // Zeitmessung ein definiertes Fenster hat. At most ONE terminal per session
  // (completedSentRef); computeTaskResult (last terminal wins) needs no change.
  const declareOutcome = useCallback(
    (outcome: "complete" | "abandon") => {
      if (!active || completedSentRef.current) return;
      if (!startedRef.current) {
        startedRef.current = true;
        push("task_start");
      }
      completedSentRef.current = true;
      push(outcome === "complete" ? "task_complete" : "task_abandon");
      flush();
    },
    [active, flush, push],
  );

  return { declareOutcome, markTaskStarted };
}

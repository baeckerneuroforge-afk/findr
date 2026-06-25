"use client";

import { useRef, useState } from "react";
import {
  EXAMPLE_BRIEFINGS,
  FAKE_THINKING_MS,
  generateProposal,
  type Proposal,
} from "../data";
import {
  ArrowRightIcon,
  PrimaryButton,
  SparkleIcon,
  TextArea,
  ThinkingState,
} from "../ui";

/**
 * Schritt 1 — Briefing in einem Satz. Die einzige Frage des Screens: „Was willst
 * du herausfinden?". Daraus erzeugt die (simulierte) KI den ganzen Vorschlag.
 */
export function StepBriefing({
  briefing,
  setBriefing,
  onComplete,
}: {
  briefing: string;
  setBriefing: (s: string) => void;
  onComplete: (p: Proposal) => void;
}) {
  const [thinking, setThinking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canGo = briefing.trim().length >= 8;

  function generate() {
    if (!canGo || thinking) return;
    setThinking(true);
    timer.current = setTimeout(() => {
      onComplete(generateProposal(briefing));
    }, FAKE_THINKING_MS);
  }

  if (thinking) {
    return <ThinkingState label="Klymeo entwirft deine Studie …" />;
  }

  return (
    <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
      <p className="text-caption font-medium uppercase tracking-wide text-primary-600">
        Schritt 1 von 4
      </p>
      <h1 className="mt-1 text-display text-neutral-900">
        Was willst du herausfinden?
      </h1>
      <p className="mt-2 max-w-[52ch] text-body text-neutral-500">
        Ein Satz genügt. Daraus baut Klymeo einen kompletten Studien-Vorschlag —
        Zielgruppe, Leitfaden und Interview-Einstellungen. Alles bestätigst oder
        änderst du danach.
      </p>

      <div className="mt-7">
        <TextArea
          rows={3}
          autoFocus
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
          }}
          placeholder="z. B. Würden berufstätige Eltern eine App für gesunde Familienrezepte nutzen – und was hält sie ab?"
          className="text-body"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-caption text-neutral-400">Beispiel:</span>
          {EXAMPLE_BRIEFINGS.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setBriefing(ex)}
              className="rounded-full border border-neutral-200 bg-card px-3 py-1 text-caption text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700"
            >
              {ex.length > 42 ? ex.slice(0, 42) + " …" : ex}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <span className="text-caption text-neutral-400">⌘/Strg + Enter</span>
        <PrimaryButton onClick={generate} disabled={!canGo}>
          <SparkleIcon className="h-4 w-4" />
          Vorschlag erzeugen
          <ArrowRightIcon className="h-4 w-4" />
        </PrimaryButton>
      </div>
    </div>
  );
}

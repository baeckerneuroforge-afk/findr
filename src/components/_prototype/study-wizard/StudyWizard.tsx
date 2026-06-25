"use client";

import { useState } from "react";
import { INITIAL_STATE, type Proposal, type StudyState } from "./data";
import { CheckIcon } from "./ui";
import { StepBriefing } from "./steps/StepBriefing";
import { StepProposal } from "./steps/StepProposal";
import { StepInterview } from "./steps/StepInterview";
import { StepReview } from "./steps/StepReview";
import { Distribution } from "./steps/Distribution";

/**
 * StudyWizard — gefuehrter 4-Schritt-Flow für die Studienerstellung (Prototyp).
 *
 *   1 Briefing → 2 Vorschlag (Zielgruppe + Leitfaden) → 3 Interview → 4 Start
 *   danach: Verteilung (post-create, ein geführter Screen)
 *
 * Reiner Client-State, Dummy-Daten, keine Backend-Calls. Legt bewusst KEINEN
 * Draft an — der produktive „heimliche Draft"-Mechanismus ist ein separates
 * Backend-Thema und hier außen vor.
 */

const STEP_LABELS = ["Briefing", "Vorschlag", "Interview", "Start"];

export function StudyWizard() {
  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<StudyState>(INITIAL_STATE);

  function update(patch: Partial<StudyState>) {
    setState((s) => ({ ...s, ...patch }));
  }

  function restart() {
    setState(INITIAL_STATE);
    setStep(0);
    setStarted(false);
  }

  // Fortschritt: nach „Start" sind alle Schritte erledigt.
  const currentIndex = started ? STEP_LABELS.length : step;

  return (
    <div className="mx-auto min-h-full max-w-2xl px-5 py-8 sm:py-12">
      {/* Kopf: Wortmarke + ehrlicher Prototyp-Hinweis */}
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-body-strong tracking-tight text-neutral-900">
            Klymeo
          </span>
          <span className="text-small text-neutral-400">Studio</span>
        </div>
        <span className="rounded-full border border-neutral-200 bg-card px-2.5 py-0.5 text-caption text-neutral-400">
          Prototyp · Dummy-Daten
        </span>
      </header>

      {/* Fortschrittsanzeige */}
      <ol className="mb-9 flex items-center">
        {STEP_LABELS.map((label, i) => {
          const done = currentIndex > i;
          const active = currentIndex === i;
          return (
            <li key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-caption font-medium transition-colors ${
                    done
                      ? "border-primary-600 bg-primary-600 text-white"
                      : active
                        ? "border-primary-400 bg-primary-50 text-primary-700"
                        : "border-neutral-200 bg-card text-neutral-400"
                  }`}
                >
                  {done ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span
                  className={`hidden text-small font-medium sm:inline ${
                    active
                      ? "text-neutral-900"
                      : done
                        ? "text-neutral-500"
                        : "text-neutral-400"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 ? (
                <span
                  className={`mx-2 h-px flex-1 ${
                    done ? "bg-primary-300" : "bg-neutral-200"
                  }`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Schritt-Inhalt */}
      {started && state.proposal ? (
        <Distribution title={state.proposal.title} onRestart={restart} />
      ) : step === 0 ? (
        <StepBriefing
          briefing={state.briefing}
          setBriefing={(briefing) => update({ briefing })}
          onComplete={(proposal: Proposal) => {
            update({ proposal });
            setStep(1);
          }}
        />
      ) : step === 1 && state.proposal ? (
        <StepProposal
          proposal={state.proposal}
          setProposal={(proposal) => update({ proposal })}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      ) : step === 2 ? (
        <StepInterview
          mode={state.mode}
          setMode={(mode) => update({ mode })}
          depth={state.depth}
          setDepth={(depth) => update({ depth })}
          language={state.language}
          setLanguage={(language) => update({ language })}
          maxRounds={state.maxRounds}
          setMaxRounds={(maxRounds) => update({ maxRounds })}
          durationMin={state.durationMin}
          setDurationMin={(durationMin) => update({ durationMin })}
          analytics={state.analytics}
          setAnalytics={(analytics) => update({ analytics })}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      ) : step === 3 && state.proposal ? (
        <StepReview
          briefing={state.briefing}
          proposal={state.proposal}
          mode={state.mode}
          depth={state.depth}
          language={state.language}
          durationMin={state.durationMin}
          analytics={state.analytics}
          onBack={() => setStep(2)}
          onStart={() => setStarted(true)}
          onEdit={(s) => setStep(s)}
        />
      ) : null}
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import {
  ArrowRightIcon,
  ErrorNote,
  GhostButton,
  PrimaryButton,
  SparkleIcon,
  TextArea,
  ThinkingState,
} from "../wizard-ui";

/**
 * Schritt 1 — Briefing in einem Satz. Einzige Frage des Screens; daraus erzeugt
 * die echte KI (POST /api/research/plans/[id]/guide) Titel + Leitfaden.
 */
export function StepBriefing({
  briefing,
  setBriefing,
  generating,
  genError,
  onGenerate,
  onManual,
}: {
  briefing: string;
  setBriefing: (s: string) => void;
  generating: boolean;
  genError: string | null;
  onGenerate: () => void;
  onManual: () => void;
}) {
  const tw = useTranslations("research.wizard");
  const canGo = briefing.trim().length >= 8;

  if (generating) {
    return <ThinkingState label={tw("s1Thinking")} />;
  }

  return (
    <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
      <p className="text-caption font-medium uppercase tracking-wide text-primary-600">
        {tw("stepCounter", { n: 1 })}
      </p>
      <h1 className="mt-1 text-display text-neutral-900">{tw("s1Title")}</h1>
      <p className="mt-2 max-w-[52ch] text-body text-neutral-500">{tw("s1Desc")}</p>

      <div className="mt-7">
        <TextArea
          rows={3}
          autoFocus
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canGo) onGenerate();
          }}
          placeholder={tw("s1Placeholder")}
          className="text-body"
        />
      </div>

      {genError ? <ErrorNote>{genError}</ErrorNote> : null}

      <div className="mt-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="hidden text-caption text-neutral-400 sm:inline">
            {tw("s1Hint")}
          </span>
          <GhostButton onClick={onManual}>{tw("s1Manual")}</GhostButton>
        </div>
        <PrimaryButton onClick={onGenerate} disabled={!canGo}>
          <SparkleIcon className="h-4 w-4" />
          {tw("s1Cta")}
          <ArrowRightIcon className="h-4 w-4" />
        </PrimaryButton>
      </div>
    </div>
  );
}

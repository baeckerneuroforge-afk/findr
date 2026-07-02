"use client";

import { useTranslations } from "next-intl";
import { StimulusUploader, type StimulusItem } from "./StimulusUploader";

/**
 * Material-Block (Konzept-/Creative-Test) — EIN Bauteil für beide Schritte
 * (StepSetup seit E2, StepGuide wie zuvor), damit Uploader-Vertrag, Styling
 * und needsStimulus-Verhalten nicht in zwei Kopien auseinanderdriften. Nur
 * der Hinweis-Text unterscheidet sich (hint).
 *
 * uploadLocked (nur Setup): der Uploader legt via ensureDraftPlanId den
 * Draft-Plan an, dessen POST ein Briefing (objective ≥3) verlangt — ohne
 * gültiges Briefing würde der Upload mit einem kryptischen 400 scheitern.
 * Solange gesperrt, zeigt der Block stattdessen den lockedHint.
 */
export function MaterialSection({
  title,
  hint,
  planId,
  ensureDraftPlanId,
  stimuli,
  setStimuli,
  uploadLocked = false,
}: {
  title: string;
  hint: string;
  planId: string | null;
  ensureDraftPlanId: () => Promise<string>;
  stimuli: StimulusItem[];
  setStimuli: React.Dispatch<React.SetStateAction<StimulusItem[]>>;
  uploadLocked?: boolean;
}) {
  const tw = useTranslations("research.wizard");

  return (
    <section className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-small font-medium text-neutral-700">{title}</p>
      <p className="mt-0.5 text-caption text-neutral-400">{hint}</p>
      {uploadLocked ? (
        <p className="mt-3 rounded-md border border-dashed border-neutral-300 px-3 py-2.5 text-caption text-neutral-500">
          {tw("setupMaterialNeedsBriefing")}
        </p>
      ) : (
        <StimulusUploader
          planId={planId}
          ensureDraftPlanId={ensureDraftPlanId}
          stimuli={stimuli}
          setStimuli={setStimuli}
        />
      )}
    </section>
  );
}

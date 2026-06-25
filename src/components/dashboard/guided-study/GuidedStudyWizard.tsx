"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  emptyTopicDraft,
  topicDraftsToResearchTopics,
  type TopicDraft,
} from "@/components/dashboard/TopicEditor";
import {
  initialWizardState,
  getUseCaseMeta,
  type GeneratedGuide,
  type WizardState,
} from "./types";
import { CheckIcon } from "./wizard-ui";
import { type StimulusItem } from "./StimulusUploader";
import { StepBriefing } from "./steps/StepBriefing";
import { StepProposal } from "./steps/StepProposal";
import { StepInterview } from "./steps/StepInterview";
import { StepReview } from "./steps/StepReview";

/**
 * GuidedStudyWizard — der echte, gefuehrte 4-Schritt-Anlege-Flow für
 * Markt-Studien. Ersetzt das große Einzelformular am /dashboard/market-research/new
 * (die klassische Form bleibt unter …/new/classic erreichbar).
 *
 * Wired gegen die echten Endpunkte — KEINE Dummy-Daten:
 *   1 Briefing → echter Draft (POST /api/research/plans) + echte KI
 *     (POST /api/research/plans/[id]/guide) erzeugen Titel + Leitfaden.
 *   2 Vorschlag → editieren; 3 Interview; 4 Start → finalisieren (PATCH bzw.
 *     POST falls manuell ohne KI) → Redirect auf die Studien-Detailseite, wo
 *     die echte Verteilung (Open-Link/Pool/E-Mail/Prolific) lebt.
 *
 * Der zweistufige Draft (KI braucht eine plan-id) ist bewusst beibehalten — der
 * „heimliche Draft" bleibt ein separates Backend-Thema; der manuelle Pfad legt
 * dagegen erst beim Start an.
 */

const DETAIL_BASE = "/dashboard/market-research";

function guideTopicsToDrafts(guide: GeneratedGuide): TopicDraft[] {
  return guide.topics.map((t) => ({
    topic: t.label,
    intent: t.goalLink,
    hypotheses: t.probes,
  }));
}

export function GuidedStudyWizard({
  voiceAvailable = true,
}: {
  voiceAvailable?: boolean;
}) {
  const tw = useTranslations("research.wizard");
  const tp = useTranslations("research.plans");
  const router = useRouter();

  const [state, setState] = useState<WizardState>(initialWizardState);
  const [step, setStep] = useState(0);
  const [planId, setPlanId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // Material-Set (Creative-/Konzepttest): echte /stimuli-Zeilen am Draft-Plan,
  // server-synchronisiert — hier gehalten, damit es Schritte überdauert und
  // finalize die Asset-Pflicht prüfen kann.
  const [stimuli, setStimuli] = useState<StimulusItem[]>([]);
  const draftPromiseRef = useRef<Promise<string> | null>(null);

  function patch(p: Partial<WizardState>) {
    setState((s) => ({ ...s, ...p }));
  }

  /** Titel für den Draft-Create, bevor die KI einen besseren liefert. */
  function effectiveTitle(): string {
    const t = state.title.trim();
    if (t.length >= 3) return t;
    const b = state.briefing.trim();
    return b.length <= 80 ? b : `${b.slice(0, 79).trimEnd()}…`;
  }

  /** Shared draft-create body (mirror der ResearchPlanForm). */
  function draftBody() {
    return {
      title: effectiveTitle(),
      objective: state.briefing.trim(),
      topics: [],
      persona: state.persona.trim() === "" ? null : state.persona.trim(),
      sampleTarget: null,
      visualCaptureEnabled: state.visualCaptureEnabled,
      eventTrackingEnabled: state.eventTrackingEnabled,
      voiceEnabled: state.voiceEnabled,
      ttsEnabled: state.ttsEnabled,
      signalsEnabled: state.signalsEnabled,
      language: state.language,
      maxRounds: null,
      maxDurationSeconds: null,
      interviewDepth: state.interviewDepth,
      useCase: state.useCase,
      audienceType: state.audienceType,
      studyType: "market_research" as const,
    };
  }

  async function ensureDraftPlanId(): Promise<string> {
    if (planId) return planId;
    if (draftPromiseRef.current) return draftPromiseRef.current;
    const create = (async () => {
      const res = await fetch("/api/research/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftBody()),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        planId?: string;
      };
      if (!res.ok || !data.planId) {
        throw new Error(data.error ?? tp("errCreatePlan"));
      }
      setPlanId(data.planId);
      return data.planId;
    })();
    draftPromiseRef.current = create;
    try {
      return await create;
    } catch (err) {
      draftPromiseRef.current = null;
      throw err;
    }
  }

  async function generate() {
    setGenError(null);
    if (state.briefing.trim().length < 8) {
      setGenError(tw("s1ErrShort"));
      return;
    }
    setGenerating(true);
    try {
      const id = await ensureDraftPlanId();
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(id)}/guide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal: state.briefing.trim(),
            audienceType: state.audienceType,
            who: state.persona.trim() === "" ? undefined : state.persona.trim(),
            language: state.language,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        guide?: GeneratedGuide;
      };
      if (res.ok && data.success && data.guide) {
        patch({
          topics: guideTopicsToDrafts(data.guide),
          title: state.title.trim() || data.guide.title,
        });
      } else {
        // Draft existiert, aber die KI-Generierung scheiterte → manuell weiter.
        patch({
          topics: state.topics.length ? state.topics : [emptyTopicDraft()],
          title: state.title.trim() || effectiveTitle(),
        });
        setGenError(tw("s2GenFailed"));
      }
      setStep(1);
    } catch (err) {
      // Draft-Anlage selbst gescheitert → auf Schritt 1 bleiben.
      setGenError(err instanceof Error ? err.message : tp("errCreatePlan"));
    } finally {
      setGenerating(false);
    }
  }

  function manualContinue() {
    setGenError(null);
    if (state.briefing.trim().length < 8) {
      setGenError(tw("s1ErrShort"));
      return;
    }
    patch({
      topics: state.topics.length ? state.topics : [emptyTopicDraft()],
      title: state.title.trim() || effectiveTitle(),
    });
    setStep(1);
  }

  /** Validate + assemble the final body, then PATCH (draft exists) or POST. */
  async function finalize() {
    setFormError(null);
    const title = effectiveTitle();
    const objective = state.briefing.trim();
    if (title.length < 3) {
      setFormError(tp("errTitleShort"));
      return;
    }
    if (objective.length < 3) {
      setFormError(tp("errObjectiveShort"));
      return;
    }

    const meta = getUseCaseMeta(state.useCase);
    if (meta.needsTask && state.taskInstruction.trim() === "") {
      setFormError(tp("errTaskInstruction"));
      return;
    }
    // Creative-/Konzepttest brauchen ein analysiertes Material — die Assets
    // hängen bereits als echte /stimuli-Zeilen am Draft (StimulusUploader).
    if (meta.needsStimulus && stimuli.length === 0) {
      setFormError(tp("errStimulusRequired"));
      return;
    }

    let sampleTarget: number | null = null;
    if (state.sampleTarget.trim() !== "") {
      const n = Number(state.sampleTarget);
      if (!Number.isInteger(n) || n < 1 || n > 1000) {
        setFormError(tp("errSampleTarget"));
        return;
      }
      sampleTarget = n;
    }

    let maxRounds: number | null = null;
    if (state.maxRounds.trim() !== "") {
      const n = Number(state.maxRounds);
      if (!Number.isInteger(n) || n < 2 || n > 15) {
        setFormError(tp("errMaxRounds"));
        return;
      }
      maxRounds = n;
    }

    let maxDurationSeconds: number | null = null;
    if (state.maxDurationMinutes.trim() !== "") {
      const n = Number(state.maxDurationMinutes);
      if (!Number.isInteger(n) || n < 3 || n > 60) {
        setFormError(tp("errMaxDuration"));
        return;
      }
      maxDurationSeconds = n * 60;
    }

    const topics = topicDraftsToResearchTopics(state.topics);

    const taskPayload =
      meta.needsTask && state.taskInstruction.trim() !== ""
        ? {
            taskDefinition: {
              instruction: state.taskInstruction.trim(),
              successCriterion: null,
              targetUrl:
                state.taskTargetUrl.trim() === ""
                  ? null
                  : state.taskTargetUrl.trim(),
              prototypeHosting: "first_party_iframe" as const,
            },
          }
        : {};

    const shared = {
      title,
      objective,
      topics,
      persona: state.persona.trim() === "" ? null : state.persona.trim(),
      sampleTarget,
      visualCaptureEnabled: state.visualCaptureEnabled,
      eventTrackingEnabled: state.eventTrackingEnabled,
      voiceEnabled: state.voiceEnabled,
      ttsEnabled: state.ttsEnabled,
      signalsEnabled: state.signalsEnabled,
      language: state.language,
      maxRounds,
      maxDurationSeconds,
      interviewDepth: state.interviewDepth,
      useCase: state.useCase,
      audienceType: state.audienceType,
      ...taskPayload,
    };

    setFinalizing(true);
    try {
      if (planId) {
        const res = await fetch(
          `/api/research/plans/${encodeURIComponent(planId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(shared),
          },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? tp("errSavePlan"));
        }
        router.push(`${DETAIL_BASE}/${planId}/launch`);
        return;
      }

      const res = await fetch("/api/research/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...shared, studyType: "market_research" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        planId?: string;
      };
      if (!res.ok || !data.planId) {
        throw new Error(data.error ?? tp("errCreatePlan"));
      }
      router.push(`${DETAIL_BASE}/${data.planId}/launch`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : tw("errFinalize"));
      setFinalizing(false);
    }
  }

  const stepLabels = [
    tw("stepBriefing"),
    tw("stepProposal"),
    tw("stepInterview"),
    tw("stepStart"),
  ];

  return (
    <div className="mx-auto max-w-2xl">
      {/* Fortschrittsanzeige */}
      <ol className="mb-9 flex items-center">
        {stepLabels.map((label, i) => {
          const done = step > i;
          const active = step === i;
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
              {i < stepLabels.length - 1 ? (
                <span
                  className={`mx-2 h-px flex-1 ${done ? "bg-primary-300" : "bg-neutral-200"}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {step === 0 ? (
        <StepBriefing
          briefing={state.briefing}
          setBriefing={(briefing) => patch({ briefing })}
          generating={generating}
          genError={genError}
          onGenerate={generate}
          onManual={manualContinue}
        />
      ) : step === 1 ? (
        <StepProposal
          state={state}
          patch={patch}
          planId={planId}
          ensureDraftPlanId={ensureDraftPlanId}
          stimuli={stimuli}
          setStimuli={setStimuli}
          genError={genError}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      ) : step === 2 ? (
        <StepInterview
          state={state}
          patch={patch}
          voiceAvailable={voiceAvailable}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      ) : (
        <StepReview
          state={state}
          finalizing={finalizing}
          formError={formError}
          onBack={() => setStep(2)}
          onEdit={(s) => setStep(s)}
          onStart={finalize}
        />
      )}
    </div>
  );
}

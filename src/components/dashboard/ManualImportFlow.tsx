"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ManualDealForm } from "./ManualDealForm";
import { TranscriptImport } from "./TranscriptImport";
import { RiskSignalDrilldown } from "./RiskSignalDrilldown";
import { getAnalysisLoadingMessage } from "@/lib/manual-import/loading";
import type { RiskAnalysisResult } from "@/lib/schemas/risk";

type Step = 1 | 2 | 3;

interface CreatedDeal {
  id: string;
  name: string;
  companyName?: string;
}

const STEPS: Array<{ step: Step; title: string; description: string }> = [
  {
    step: 1,
    title: "Create a deal",
    description: "Add the pipeline context Findr needs.",
  },
  {
    step: 2,
    title: "Add transcripts",
    description: "Paste one or more call transcripts.",
  },
  {
    step: 3,
    title: "Analyze",
    description: "Run the real AI risk analysis.",
  },
];

export function ManualImportFlow() {
  const [step, setStep] = useState<Step>(1);
  const [createdDeal, setCreatedDeal] = useState<CreatedDeal | null>(null);
  const [callIds, setCallIds] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<RiskAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStatusIndex, setAnalysisStatusIndex] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    if (!analyzing) {
      setAnalysisStatusIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setAnalysisStatusIndex((current) => current + 1);
    }, 3500);

    return () => window.clearInterval(intervalId);
  }, [analyzing]);

  async function analyze() {
    if (!createdDeal) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);

    try {
      const response = await fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: createdDeal.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.result) {
        throw new Error(data.detail ?? data.error ?? "Risk analysis failed.");
      }
      setAnalysis(data.result);
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : "Risk analysis failed.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6">
      <Progress currentStep={step} />

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        {step === 1 && (
          <div className="space-y-5">
            <StepHeader
              eyebrow="Step 1"
              title="Create a deal"
              description="Manual imports behave like any other Findr deal. They use source=manual, so the real AI path runs instead of the demo snapshot."
            />
            <ManualDealForm
              onCreated={(deal) => {
                setCreatedDeal(deal);
                setStep(2);
              }}
            />
          </div>
        )}

        {step === 2 && createdDeal && (
          <div className="space-y-5">
            <StepHeader
              eyebrow="Step 2"
              title={`Add transcripts for ${createdDeal.name}`}
              description="A deal can have multiple calls. Add at least one transcript before analyzing."
            />
            <TranscriptImport
              dealId={createdDeal.id}
              onAdded={(call) => {
                setCallIds((current) => [...current, call.id]);
              }}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
              <p className="text-small text-neutral-500">
                {callIds.length} {callIds.length === 1 ? "transcript" : "transcripts"}{" "}
                added
              </p>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={callIds.length === 0}
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary-600 px-4 text-body-strong font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue to analysis
              </button>
            </div>
          </div>
        )}

        {step === 3 && createdDeal && (
          <div className="space-y-5">
            <StepHeader
              eyebrow="Step 3"
              title="Run AI risk analysis"
              description="Findr will analyze the pasted transcript evidence and persist the score on the deal."
            />

            {!analysis && (
              <div className="rounded-lg border border-primary-100 bg-primary-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-body-strong text-neutral-900">
                      Ready to analyze {createdDeal.name}
                    </div>
                    <p className="mt-1 text-body text-neutral-600">
                      {callIds.length} transcript
                      {callIds.length === 1 ? "" : "s"} attached. This calls the
                      real risk-analysis endpoint.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={analyze}
                    disabled={analyzing}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary-600 px-4 text-body-strong font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-80"
                  >
                    {analyzing && (
                      <span
                        className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    )}
                    {analyzing ? "Analyzing..." : "Analyze now"}
                  </button>
                </div>
                {analyzing && (
                  <AnalysisLoadingState
                    message={getAnalysisLoadingMessage(analysisStatusIndex)}
                  />
                )}
              </div>
            )}

            {analysisError && (
              <div className="rounded-lg border border-danger-500/20 bg-danger-50 p-4">
                <div className="text-body-strong text-danger-700">
                  Analysis failed — please try again.
                </div>
                <p className="mt-1 text-small text-danger-700/80">
                  {analysisError}
                </p>
                <button
                  type="button"
                  onClick={analyze}
                  disabled={analyzing}
                  className="mt-3 inline-flex h-8 items-center justify-center rounded-md bg-white px-3 text-body-strong text-danger-700 ring-1 ring-danger-500/20 transition-colors hover:bg-danger-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Retry analysis
                </button>
              </div>
            )}

            {analysis && (
              <div className="space-y-5">
                <RiskSignalDrilldown
                  riskScore={analysis.riskScore}
                  riskLevel={analysis.riskLevel}
                  overallReasoning={analysis.overallReasoning}
                  recommendations={analysis.recommendations ?? []}
                  signals={analysis.signals}
                  sourceCallCount={callIds.length}
                />

                <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-4">
                  <Link
                    href={`/dashboard/deals/${createdDeal.id}`}
                    className="inline-flex h-9 items-center justify-center rounded-md bg-primary-600 px-4 text-body-strong font-medium text-white transition-colors hover:bg-primary-700"
                  >
                    View full deal
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setCreatedDeal(null);
                      setCallIds([]);
                      setAnalysis(null);
                      setAnalysisError(null);
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-neutral-200 bg-white px-4 text-body-strong text-neutral-700 transition-colors hover:bg-neutral-50"
                  >
                    Import another deal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function AnalysisLoadingState({ message }: { message: string }) {
  return (
    <div
      className="mt-4 rounded-lg border border-primary-100 bg-white p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-body-strong text-neutral-900">{message}</div>
          <p className="mt-1 max-w-xl text-small leading-relaxed text-neutral-500">
            Findr&apos;s AI is analyzing the call evidence. Opus is thorough, so
            this can take a moment for the most accurate result.
          </p>
        </div>
        <span className="rounded-md bg-primary-50 px-2 py-1 text-caption font-medium text-primary-700">
          Live analysis
        </span>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-primary-100"
        aria-label="AI analysis in progress"
        role="progressbar"
      >
        <div className="h-full w-1/3 rounded-full bg-primary-500 animate-analysis-progress motion-reduce:w-full motion-reduce:animate-none" />
      </div>
    </div>
  );
}

function Progress({ currentStep }: { currentStep: Step }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-body-strong text-neutral-900">
          Manual import progress
        </div>
        <div className="text-small text-neutral-500">Step {currentStep} of 3</div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {STEPS.map((item) => {
          const done = item.step < currentStep;
          const active = item.step === currentStep;
          return (
            <div
              key={item.step}
              className={`rounded-md border p-3 ${
                active
                  ? "border-primary-200 bg-primary-50"
                  : done
                    ? "border-success-500/20 bg-success-50"
                    : "border-neutral-200 bg-neutral-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-caption font-semibold ${
                    done
                      ? "bg-success-500 text-white"
                      : active
                        ? "bg-primary-600 text-white"
                        : "bg-neutral-200 text-neutral-500"
                  }`}
                >
                  {done ? "✓" : item.step}
                </span>
                <span className="text-body-strong text-neutral-900">
                  {item.title}
                </span>
              </div>
              <p className="mt-1 text-small text-neutral-500">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="text-caption font-medium uppercase tracking-wider text-primary-700">
        {eyebrow}
      </div>
      <h2 className="mt-1 text-h1 text-neutral-900">{title}</h2>
      <p className="mt-1 max-w-2xl text-body text-neutral-500">
        {description}
      </p>
    </div>
  );
}

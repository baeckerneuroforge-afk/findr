"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/onboarding/steps";
import type { OnboardingStatus } from "@/lib/onboarding/status";

interface OnboardingChecklistProps {
  status: OnboardingStatus;
}

function isStepComplete(step: OnboardingStep, status: OnboardingStatus) {
  if (step.id === "connect_data") return status.has_integration;
  if (step.id === "first_analysis") return status.has_risk_analysis;
  return status.has_slack;
}

export function OnboardingChecklist({ status }: OnboardingChecklistProps) {
  const t = useTranslations("common.onboarding");
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || status.is_complete) return null;

  const progressPct =
    status.total_steps > 0
      ? (status.completed_steps / status.total_steps) * 100
      : 0;

  return (
    <section className="rounded-lg border border-primary-100 bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-caption font-medium uppercase tracking-wider text-primary-700">
            {t("eyebrow")}
          </div>
          <h2 className="mt-1 text-h2 text-neutral-900">{t("title")}</h2>
          <p className="mt-1 text-body text-neutral-500">
            {t("progress", {
              completed: status.completed_steps,
              total: status.total_steps,
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          aria-label={t("dismissAria")}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z" />
          </svg>
        </button>
      </div>

      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-primary-500 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {ONBOARDING_STEPS.map((step) => {
          const complete = isStepComplete(step, status);
          const isNext = status.next_step?.id === step.id;

          return (
            <div
              key={step.id}
              className={`rounded-lg border p-4 ${
                isNext
                  ? "border-primary-200 bg-primary-50"
                  : "border-neutral-200 bg-card"
              }`}
            >
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-caption ${
                    complete
                      ? "border-success-500 bg-success-500 text-white"
                      : isNext
                        ? "border-primary-500 bg-card text-primary-700"
                        : "border-neutral-300 bg-card text-neutral-400"
                  }`}
                  aria-hidden="true"
                >
                  {complete && (
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.313a1 1 0 0 1-1.42 0L3.29 9.226a1 1 0 1 1 1.42-1.408l4.04 4.073 6.54-6.594a1 1 0 0 1 1.414-.006Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </span>
                <h3
                  className={`text-body-strong ${
                    complete ? "text-neutral-500 line-through" : "text-neutral-900"
                  }`}
                >
                  {t(`steps.${step.id}.title`)}
                </h3>
              </div>
              <p className="text-small text-neutral-500">
                {t(`steps.${step.id}.description`)}
              </p>
              {!complete && (
                <Link
                  href={step.href}
                  className={`mt-4 inline-flex h-8 items-center justify-center rounded-md px-3 text-body-strong font-medium transition-colors ${
                    isNext
                      ? "bg-primary-600 text-white hover:bg-primary-hover"
                      : "border border-neutral-200 bg-card text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {t(`steps.${step.id}.cta`)}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

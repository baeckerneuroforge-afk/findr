"use client";

import { useState } from "react";
import type { RepCoachingProfile } from "@/lib/coaching/service";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";

const SIGNAL_LABELS: Record<string, string> = {
  CHAMPION_LOSS: "Champion Loss",
  COMPETITOR_PRESSURE: "Competitor Pressure",
  STALLING_PATTERN: "Stalling Pattern",
  BUDGET_FRICTION: "Budget Friction",
  CHAMPION_DISENGAGEMENT: "Champion Disengagement",
  LATE_DECISION_MAKER: "Late Decision Maker",
  STAKEHOLDER_CHURN: "Stakeholder Churn",
  ENGAGEMENT_DROP: "Engagement Drop",
};

interface CoachingDashboardProps {
  profiles: RepCoachingProfile[];
}

export function CoachingDashboard({ profiles }: CoachingDashboardProps) {
  const [expandedRep, setExpandedRep] = useState<string | null>(
    profiles[0]?.repName ?? null,
  );

  if (profiles.length === 0) {
    return (
      <EmptyState
        title="No coaching data yet"
        description="Run risk analysis on a few deals to reveal team patterns, coaching recommendations, and rep-level risk trends."
        cta={{ label: "Go to pipeline", href: "/dashboard" }}
      />
    );
  }

  const activeDeals = profiles.reduce(
    (sum, profile) => sum + profile.activeDeals,
    0,
  );
  const dealsAtRisk = profiles.reduce(
    (sum, profile) => sum + profile.dealsAtRisk,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Reps tracked" value={profiles.length} />
        <StatCard label="Total active deals" value={activeDeals} />
        <StatCard
          label="Deals at risk"
          value={dealsAtRisk}
          status={dealsAtRisk > 0 ? "critical" : "default"}
        />
      </div>

      {profiles.map((profile) => {
        const isExpanded = expandedRep === profile.repName;
        const atRiskRatio =
          profile.totalDeals > 0
            ? Math.round((profile.dealsAtRisk / profile.totalDeals) * 100)
            : 0;
        const signalEntries = Object.entries(profile.signalFrequency).sort(
          ([, a], [, b]) => b - a,
        );
        const maxSignalCount =
          signalEntries.length > 0
            ? Math.max(...signalEntries.map(([, count]) => count))
            : 0;
        const patternRatio =
          profile.topPattern && profile.totalDeals > 0
            ? Math.round(
                (profile.topPattern.frequency / profile.totalDeals) * 100,
              )
            : 0;

        const ratioStyle =
          profile.dealsAtRisk === 0
            ? "bg-neutral-100 text-neutral-500"
            : atRiskRatio >= 50
              ? "bg-danger-50 text-danger-700"
              : atRiskRatio >= 30
                ? "bg-warning-50 text-warning-700"
                : "bg-success-50 text-success-700";

        return (
          <div
            key={profile.repName}
            className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedRep(isExpanded ? null : profile.repName)
              }
              className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-neutral-50"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary-100 bg-primary-50 text-small font-semibold text-primary-700">
                  {getInitials(profile.repName)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-body-strong text-neutral-900">
                    {profile.repName}
                  </div>
                  <div className="mt-0.5 text-small text-neutral-500">
                    {profile.activeDeals} active · {profile.dealsAtRisk} at risk ·
                    avg risk {profile.avgRiskScore}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-4">
                {profile.topPattern && (
                  <div className="hidden text-right sm:block">
                    <div className="mb-1 text-caption text-neutral-500">
                      Top pattern
                    </div>
                    <div className="text-small font-medium text-warning-700">
                      {SIGNAL_LABELS[profile.topPattern.type] ??
                        profile.topPattern.type}
                    </div>
                  </div>
                )}
                <div
                  className={`rounded-md px-3 py-1.5 text-small font-semibold ${ratioStyle}`}
                >
                  {atRiskRatio}% at risk
                </div>
                <svg
                  className={`h-4 w-4 text-neutral-400 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>

            {isExpanded && (
              <div className="space-y-5 border-t border-neutral-200 px-5 pb-5 pt-5">
                {profile.topPattern && (
                  <div className="rounded-lg border border-warning-500/30 bg-warning-50 p-4">
                    <div className="mb-1 text-caption font-medium uppercase tracking-wider text-warning-700">
                      Manager insight
                    </div>
                    <p className="text-body leading-relaxed text-neutral-900">
                      {profile.repName} shows{" "}
                      {SIGNAL_LABELS[profile.topPattern.type] ??
                        profile.topPattern.type}{" "}
                      in {patternRatio}% of tracked deals.
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="mb-3 text-h3 text-neutral-900">
                    Loss pattern frequency
                  </h4>
                  {signalEntries.length === 0 ? (
                    <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-body text-neutral-500">
                      No loss patterns detected yet for this rep.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {signalEntries.map(([type, count]) => {
                        const widthPct =
                          maxSignalCount > 0
                            ? (count / maxSignalCount) * 100
                            : 0;

                        return (
                          <div key={type}>
                            <div className="mb-1 flex items-center justify-between gap-3">
                              <span className="truncate text-small text-neutral-700">
                                {SIGNAL_LABELS[type] ?? type}
                              </span>
                              <span className="shrink-0 text-caption text-neutral-500">
                                {count}× detected
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                              <div
                                className="h-full bg-primary-500"
                                style={{ width: `${widthPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {profile.recommendations.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-h3 text-neutral-900">
                      Coaching recommendations
                    </h4>
                    <p className="mb-3 text-small text-neutral-500">
                      Based on top pattern:{" "}
                      {SIGNAL_LABELS[profile.topPattern?.type ?? ""] ?? ""}
                    </p>
                    <div className="space-y-2">
                      {profile.recommendations.map((recommendation, i) => (
                        <div
                          key={recommendation}
                          className="flex items-start gap-3 rounded-lg border border-primary-100 bg-primary-50 p-3"
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-500 text-caption font-semibold text-white">
                            {i + 1}
                          </div>
                          <p className="text-body leading-relaxed text-neutral-900">
                            {recommendation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

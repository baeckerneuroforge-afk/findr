"use client";

import { useState } from "react";
import type { RepCoachingProfile } from "@/lib/coaching/service";

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
      <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center text-mist/50">
        No coaching data yet. Run risk analysis on deals to generate insights.
      </div>
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
        <StatCard label="Reps Tracked" value={profiles.length} />
        <StatCard label="Total Active Deals" value={activeDeals} />
        <StatCard label="At Risk" value={dealsAtRisk} highlight />
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
            ? Math.round((profile.topPattern.frequency / profile.totalDeals) * 100)
            : 0;

        return (
          <div
            key={profile.repName}
            className="overflow-hidden rounded-xl border border-white/10 bg-white/5"
          >
            <button
              type="button"
              onClick={() => setExpandedRep(isExpanded ? null : profile.repName)}
              className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-white/5"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/20 text-sm font-semibold text-white">
                  {getInitials(profile.repName)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">
                    {profile.repName}
                  </div>
                  <div className="mt-0.5 text-xs text-mist/50">
                    {profile.activeDeals} active - {profile.dealsAtRisk} at risk
                    - avg risk {profile.avgRiskScore}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-4">
                {profile.topPattern && (
                  <div className="hidden text-right sm:block">
                    <div className="mb-1 text-xs text-mist/50">Top pattern</div>
                    <div className="text-sm font-medium text-orange-400">
                      {SIGNAL_LABELS[profile.topPattern.type] ??
                        profile.topPattern.type}
                    </div>
                  </div>
                )}
                <div
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    atRiskRatio >= 50
                      ? "bg-red-500/20 text-red-400"
                      : atRiskRatio >= 30
                        ? "bg-orange-500/20 text-orange-400"
                        : "bg-emerald-500/20 text-emerald-400"
                  }`}
                >
                  {atRiskRatio}% at risk
                </div>
                <svg
                  className={`h-5 w-5 text-mist/50 transition-transform ${
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
              <div className="space-y-5 border-t border-white/5 px-5 pb-5 pt-5">
                {profile.topPattern && (
                  <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wider text-orange-300/80">
                      Manager Insight
                    </div>
                    <p className="text-sm leading-relaxed text-white/90">
                      {profile.repName} shows{" "}
                      {SIGNAL_LABELS[profile.topPattern.type] ??
                        profile.topPattern.type}{" "}
                      in {patternRatio}% of tracked deals.
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="mb-3 text-sm font-semibold text-white">
                    Loss Pattern Frequency
                  </h4>
                  {signalEntries.length === 0 ? (
                    <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-mist/50">
                      No loss patterns detected yet for this rep.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {signalEntries.map(([type, count]) => {
                        const widthPct =
                          maxSignalCount > 0 ? (count / maxSignalCount) * 100 : 0;

                        return (
                          <div key={type}>
                            <div className="mb-1 flex items-center justify-between gap-3">
                              <span className="truncate text-xs text-mist/70">
                                {SIGNAL_LABELS[type] ?? type}
                              </span>
                              <span className="shrink-0 text-xs text-mist/50">
                                {count}x detected
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                              <div
                                className="h-full bg-violet-500/60"
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
                    <h4 className="mb-3 text-sm font-semibold text-white">
                      Coaching Recommendations
                    </h4>
                    <p className="mb-3 text-xs text-mist/50">
                      Based on top pattern:{" "}
                      {SIGNAL_LABELS[profile.topPattern?.type ?? ""] ?? ""}
                    </p>
                    <div className="space-y-2">
                      {profile.recommendations.map((recommendation, i) => (
                        <div
                          key={recommendation}
                          className="flex items-start gap-3 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3"
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/20 text-xs font-semibold text-violet-400">
                            {i + 1}
                          </div>
                          <p className="text-sm leading-relaxed text-white/90">
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

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white/5 p-5 ${
        highlight ? "border-red-500/30" : "border-white/10"
      }`}
    >
      <div className="mb-2 text-xs text-mist/50">{label}</div>
      <div
        className={`text-3xl font-bold ${
          highlight ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </div>
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

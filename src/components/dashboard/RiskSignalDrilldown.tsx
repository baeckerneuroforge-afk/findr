"use client";

import { useState } from "react";
import type { RiskSignal } from "@/lib/risk/service";

interface RiskSignalDrilldownProps {
  riskScore: number;
  riskLevel: string;
  overallReasoning: string;
  recommendations: string[];
  signals: RiskSignal[];
  analyzedAt?: string;
}

const SIGNAL_META: Record<
  string,
  { label: string; description: string; severity: number }
> = {
  CHAMPION_LOSS: {
    label: "Champion Loss",
    description: "Internal advocate is disengaging or leaving",
    severity: 4,
  },
  COMPETITOR_PRESSURE: {
    label: "Competitor Pressure",
    description: "Active competitor evaluation detected",
    severity: 3,
  },
  STALLING_PATTERN: {
    label: "Stalling Pattern",
    description: "Deal velocity is decreasing",
    severity: 3,
  },
  BUDGET_FRICTION: {
    label: "Budget Friction",
    description: "Pricing concerns surfacing",
    severity: 3,
  },
  CHAMPION_DISENGAGEMENT: {
    label: "Champion Disengagement",
    description: "Champion exists but losing energy",
    severity: 3,
  },
  LATE_DECISION_MAKER: {
    label: "Late Decision Maker",
    description: "New senior stakeholder enters late",
    severity: 4,
  },
  STAKEHOLDER_CHURN: {
    label: "Stakeholder Churn",
    description: "Buyer team is changing",
    severity: 4,
  },
  ENGAGEMENT_DROP: {
    label: "Engagement Drop",
    description: "Overall buyer engagement falling",
    severity: 2,
  },
};

function getSeverityFill(severity: number): string {
  if (severity >= 4) return "bg-danger-500";
  if (severity >= 3) return "bg-warning-500";
  return "bg-success-500";
}

function getRiskHeaderStyle(level: string): string {
  if (level === "critical") return "bg-danger-50 border-danger-500/30";
  if (level === "high") return "bg-orange-50 border-orange-500/30";
  if (level === "medium") return "bg-warning-50 border-warning-500/30";
  return "bg-success-50 border-success-500/30";
}

function getRiskBadgeStyle(level: string): string {
  if (level === "critical")
    return "bg-danger-500 text-white";
  if (level === "high")
    return "bg-orange-500 text-white";
  if (level === "medium")
    return "bg-warning-500 text-white";
  return "bg-success-500 text-white";
}

export function RiskSignalDrilldown({
  riskScore,
  riskLevel,
  overallReasoning,
  recommendations,
  signals,
  analyzedAt,
}: RiskSignalDrilldownProps) {
  const [expandedSignal, setExpandedSignal] = useState<string | null>(
    signals[0]?.type ?? null,
  );

  const sortedSignals = [...signals].sort(
    (a, b) => b.confidence - a.confidence,
  );

  return (
    <div className="space-y-6">
      <div
        className={`relative overflow-hidden rounded-lg border p-6 ${getRiskHeaderStyle(riskLevel)}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-caption uppercase tracking-wider text-neutral-500">
              Risk assessment
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-display text-neutral-900">{riskScore}</span>
              <span className="text-small text-neutral-500">/ 100</span>
              <span
                className={`rounded-md px-2 py-0.5 text-caption font-semibold uppercase ${getRiskBadgeStyle(riskLevel)}`}
              >
                {riskLevel}
              </span>
            </div>
          </div>
          {analyzedAt && (
            <div className="text-caption text-neutral-500">
              Analyzed {new Date(analyzedAt).toLocaleString("de-DE")}
            </div>
          )}
        </div>
        <p className="mt-4 text-body leading-relaxed text-neutral-700">
          {overallReasoning}
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-h3 uppercase tracking-wider text-neutral-500">
          Detected signals ({signals.length})
        </h3>
        <div className="space-y-2">
          {sortedSignals.map((signal) => {
            const meta = SIGNAL_META[signal.type] ?? {
              label: signal.type,
              description: "",
              severity: 2,
            };
            const isExpanded = expandedSignal === signal.type;
            const confidencePct = Math.round(signal.confidence * 100);

            return (
              <div
                key={signal.type}
                className={`rounded-lg border transition-all ${
                  isExpanded
                    ? "border-primary-200 bg-primary-50/50"
                    : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSignal(isExpanded ? null : signal.type)
                  }
                  className="flex w-full items-center gap-4 px-4 py-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-body-strong text-neutral-900">
                        {meta.label}
                      </span>
                      <span className="text-caption text-neutral-500">
                        {confidencePct}% confidence
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className={`h-full rounded-full transition-all ${getSeverityFill(meta.severity)}`}
                        style={{ width: `${confidencePct}%` }}
                      />
                    </div>
                  </div>
                  <svg
                    className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="space-y-3 border-t border-neutral-200 px-4 pb-4 pt-3">
                    {meta.description && (
                      <p className="text-caption italic text-neutral-500">
                        {meta.description}
                      </p>
                    )}
                    <div>
                      <div className="mb-1 text-caption uppercase tracking-wider text-neutral-500">
                        Reasoning
                      </div>
                      <p className="text-body leading-relaxed text-neutral-700">
                        {signal.reasoning}
                      </p>
                    </div>
                    {signal.quotes && signal.quotes.length > 0 && (
                      <div>
                        <div className="mb-2 text-caption uppercase tracking-wider text-neutral-500">
                          Triggering quotes ({signal.quotes.length})
                        </div>
                        <div className="space-y-2">
                          {signal.quotes.map((quote, i) => (
                            <div
                              key={i}
                              className="rounded-md border-l-2 border-primary-500 bg-neutral-100 px-3 py-2"
                            >
                              <p className="text-body italic leading-relaxed text-neutral-700">
                                &ldquo;{quote}&rdquo;
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
      </div>

      {recommendations.length > 0 && (
        <div>
          <h3 className="mb-3 text-h3 uppercase tracking-wider text-neutral-500">
            Recommended actions
          </h3>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-500 text-caption font-semibold text-white">
                  {i + 1}
                </div>
                <p className="text-body leading-relaxed text-neutral-900">
                  {rec}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

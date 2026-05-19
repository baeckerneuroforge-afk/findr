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

function getSeverityColor(severity: number): string {
  if (severity >= 4) return "from-red-500 to-red-600";
  if (severity >= 3) return "from-orange-500 to-orange-600";
  return "from-yellow-500 to-yellow-600";
}

function getRiskBgGradient(level: string): string {
  if (level === "critical") return "from-red-500/20 to-red-700/10";
  if (level === "high") return "from-orange-500/20 to-orange-700/10";
  if (level === "medium") return "from-yellow-500/20 to-yellow-700/10";
  return "from-emerald-500/20 to-emerald-700/10";
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
        className={`relative rounded-2xl p-6 bg-gradient-to-br ${getRiskBgGradient(
          riskLevel,
        )} border border-white/10 overflow-hidden`}
      >
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
            <div>
              <div className="text-xs text-mist/60 uppercase tracking-wider mb-1">
                Risk Assessment
              </div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-5xl font-bold text-white">
                  {riskScore}
                </span>
                <span className="text-sm text-mist/50">/ 100</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${
                    riskLevel === "critical"
                      ? "bg-red-500/20 text-red-300 border-red-500/40"
                      : riskLevel === "high"
                      ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                      : riskLevel === "medium"
                      ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  }`}
                >
                  {riskLevel.toUpperCase()}
                </span>
              </div>
            </div>
            {analyzedAt && (
              <div className="text-xs text-mist/50">
                Analyzed {new Date(analyzedAt).toLocaleString("de-DE")}
              </div>
            )}
          </div>
          <p className="text-sm text-mist/80 leading-relaxed">
            {overallReasoning}
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
          Detected Signals ({signals.length})
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
                className={`rounded-xl border transition-all ${
                  isExpanded
                    ? "bg-white/[0.03] border-violet-500/30"
                    : "bg-white/[0.01] border-white/5 hover:border-white/10"
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSignal(isExpanded ? null : signal.type)
                  }
                  className="w-full px-4 py-3 flex items-center gap-4 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-white font-medium">
                        {meta.label}
                      </span>
                      <span className="text-xs text-mist/40">
                        {confidencePct}% confidence
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${getSeverityColor(
                          meta.severity,
                        )} rounded-full transition-all`}
                        style={{ width: `${confidencePct}%` }}
                      />
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-mist/40 transition-transform shrink-0 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                    {meta.description && (
                      <p className="text-xs text-mist/60 italic">
                        {meta.description}
                      </p>
                    )}
                    <div>
                      <div className="text-xs text-mist/50 uppercase tracking-wider mb-1">
                        Reasoning
                      </div>
                      <p className="text-sm text-mist/80 leading-relaxed">
                        {signal.reasoning}
                      </p>
                    </div>
                    {signal.quotes && signal.quotes.length > 0 && (
                      <div>
                        <div className="text-xs text-mist/50 uppercase tracking-wider mb-2">
                          Triggering Quotes ({signal.quotes.length})
                        </div>
                        <div className="space-y-2">
                          {signal.quotes.map((quote, i) => (
                            <div
                              key={i}
                              className="bg-black/20 rounded-lg px-3 py-2 border-l-2 border-violet-500/40"
                            >
                              <p className="text-sm text-mist/80 italic leading-relaxed">
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
          <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
            Recommended Actions
          </h3>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-3 bg-violet-500/5 border border-violet-500/20 rounded-lg px-4 py-3"
              >
                <div className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 text-xs font-semibold flex items-center justify-center shrink-0">
                  {i + 1}
                </div>
                <p className="text-sm text-mist/80 leading-relaxed">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

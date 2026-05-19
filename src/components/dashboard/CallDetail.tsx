"use client";

import { useState } from "react";

interface Speaker {
  id: string;
  name: string;
  role: string;
  speaker_type: string;
}

interface Segment {
  id: string;
  speaker_id: string;
  start_seconds: number;
  end_seconds: number;
  text: string;
  signals: string[];
}

interface CallDetailProps {
  call: {
    id: string;
    call_type: string | null;
    duration_seconds: number | null;
    recorded_at: string | null;
    transcript_summary: string | null;
    call_speakers: Speaker[];
    transcript_segments: Segment[];
  };
}

const SIGNAL_LABELS: Record<string, { label: string; color: string }> = {
  CHAMPION_LOSS: { label: "Champion Loss", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  COMPETITOR_PRESSURE: { label: "Competitor", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  STALLING_PATTERN: { label: "Stalling", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  BUDGET_FRICTION: { label: "Budget", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  CHAMPION_DISENGAGEMENT: { label: "Disengagement", color: "bg-pink-500/20 text-pink-300 border-pink-500/30" },
  LATE_DECISION_MAKER: { label: "Late DM", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  STAKEHOLDER_CHURN: { label: "Stakeholder Churn", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  ENGAGEMENT_DROP: { label: "Engagement Drop", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function CallDetail({ call }: CallDetailProps) {
  const [filter, setFilter] = useState<"all" | "signals">("all");

  const speakerById = (id: string) =>
    call.call_speakers.find((s) => s.id === id);

  const segments =
    filter === "signals"
      ? call.transcript_segments.filter((s) => s.signals.length > 0)
      : call.transcript_segments;

  return (
    <div className="bg-white/[0.02] border border-violet-500/20 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs uppercase tracking-wide text-violet-300">
              {call.call_type ?? "call"}
            </span>
            <span className="text-xs text-mist/50">·</span>
            <span className="text-xs text-mist/50">
              {formatTime(call.duration_seconds ?? 0)}
            </span>
            {call.recorded_at && (
              <>
                <span className="text-xs text-mist/50">·</span>
                <span className="text-xs text-mist/50">
                  {new Date(call.recorded_at).toLocaleDateString("de-DE")}
                </span>
              </>
            )}
          </div>
          {call.transcript_summary && (
            <p className="text-sm text-mist/80 leading-relaxed">
              {call.transcript_summary}
            </p>
          )}
        </div>

        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`text-xs px-3 py-1 rounded-md transition-colors ${
              filter === "all"
                ? "bg-violet-500/20 text-violet-200"
                : "text-mist/60 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("signals")}
            className={`text-xs px-3 py-1 rounded-md transition-colors ${
              filter === "signals"
                ? "bg-red-500/20 text-red-300"
                : "text-mist/60 hover:text-white"
            }`}
          >
            Risk Signals
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
        {segments.length === 0 ? (
          <p className="text-center text-sm text-mist/40 py-8">
            No segments matching this filter.
          </p>
        ) : (
          segments.map((segment) => {
            const speaker = speakerById(segment.speaker_id);
            const isSalesRep = speaker?.speaker_type === "sales_rep";
            const hasSignals = segment.signals.length > 0;

            return (
              <div
                key={segment.id}
                className={`p-3 rounded-lg border ${
                  hasSignals
                    ? "bg-red-500/5 border-red-500/20"
                    : "bg-white/[0.02] border-white/5"
                }`}
              >
                <div className="flex items-start justify-between mb-1 gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium ${
                        isSalesRep ? "text-violet-300" : "text-emerald-300"
                      }`}
                    >
                      {speaker?.name ?? "Unknown"}
                    </span>
                    <span className="text-xs text-mist/40">
                      {formatTime(segment.start_seconds)}
                    </span>
                  </div>
                  {hasSignals && (
                    <div className="flex gap-1 flex-wrap justify-end">
                      {segment.signals.map((sig) => {
                        const meta = SIGNAL_LABELS[sig];
                        if (!meta) {
                          return (
                            <span
                              key={sig}
                              className="text-[10px] px-2 py-0.5 rounded-full border bg-violet-500/15 text-violet-300 border-violet-500/30"
                            >
                              {sig}
                            </span>
                          );
                        }
                        return (
                          <span
                            key={sig}
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.color}`}
                          >
                            {meta.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="text-sm text-mist/80 leading-relaxed">
                  {segment.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

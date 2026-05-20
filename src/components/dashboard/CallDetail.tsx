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

const SIGNAL_LABELS: Record<string, { label: string; tone: string }> = {
  CHAMPION_LOSS: { label: "Champion Loss", tone: "danger" },
  COMPETITOR_PRESSURE: { label: "Competitor", tone: "warning" },
  STALLING_PATTERN: { label: "Stalling", tone: "warning" },
  BUDGET_FRICTION: { label: "Budget", tone: "warning" },
  CHAMPION_DISENGAGEMENT: { label: "Disengagement", tone: "danger" },
  LATE_DECISION_MAKER: { label: "Late DM", tone: "warning" },
  STAKEHOLDER_CHURN: { label: "Stakeholder Churn", tone: "danger" },
  ENGAGEMENT_DROP: { label: "Engagement Drop", tone: "warning" },
};

const TONE_STYLES: Record<string, string> = {
  danger: "bg-danger-50 text-danger-700 border-danger-500/30",
  warning: "bg-warning-50 text-warning-700 border-warning-500/30",
  default: "bg-neutral-100 text-neutral-700 border-neutral-200",
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
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-caption uppercase tracking-wide text-primary-700 font-medium">
              {call.call_type ?? "call"}
            </span>
            <span className="text-caption text-neutral-400">·</span>
            <span className="text-caption text-neutral-500">
              {formatTime(call.duration_seconds ?? 0)}
            </span>
            {call.recorded_at && (
              <>
                <span className="text-caption text-neutral-400">·</span>
                <span className="text-caption text-neutral-500">
                  {new Date(call.recorded_at).toLocaleDateString("de-DE")}
                </span>
              </>
            )}
          </div>
          {call.transcript_summary && (
            <p className="text-body leading-relaxed text-neutral-700">
              {call.transcript_summary}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-md px-2.5 py-1 text-caption font-medium transition-colors ${
              filter === "all"
                ? "bg-neutral-100 text-neutral-900"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("signals")}
            className={`rounded-md px-2.5 py-1 text-caption font-medium transition-colors ${
              filter === "signals"
                ? "bg-danger-50 text-danger-700"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Risk signals
          </button>
        </div>
      </div>

      <div className="max-h-[500px] space-y-3 overflow-y-auto pr-2">
        {segments.length === 0 ? (
          <p className="py-8 text-center text-small text-neutral-400">
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
                className={`rounded-lg border p-3 ${
                  hasSignals
                    ? "border-danger-500/30 bg-danger-50/40"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-caption font-medium ${
                        isSalesRep ? "text-primary-700" : "text-success-700"
                      }`}
                    >
                      {speaker?.name ?? "Unknown"}
                    </span>
                    <span className="text-caption text-neutral-400">
                      {formatTime(segment.start_seconds)}
                    </span>
                  </div>
                  {hasSignals && (
                    <div className="flex flex-wrap justify-end gap-1">
                      {segment.signals.map((sig) => {
                        const meta = SIGNAL_LABELS[sig];
                        const tone = meta?.tone ?? "default";
                        const label = meta?.label ?? sig;
                        return (
                          <span
                            key={sig}
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${TONE_STYLES[tone]}`}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="text-body leading-relaxed text-neutral-700">
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

"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toBcp47 } from "@/i18n/locale";
import { loadCallDetail } from "@/lib/calls/actions";
import type { CallRow, DealCallSummary } from "@/lib/calls/service";

interface CallDetailProps {
  /** Lean row from getCallSummariesByDealId — enough for the header + collapsed
   *  list. The heavy body (transcript / speakers / segments) is fetched on
   *  demand the first time the call is expanded. */
  summary: DealCallSummary;
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

export function CallDetail({ summary }: CallDetailProps) {
  const t = useTranslations("sales.deal");
  const locale = useLocale();
  const [filter, setFilter] = useState<"all" | "signals">("all");
  const [open, setOpen] = useState(false);
  // Full detail is fetched once and cached in state — re-expanding never refetches.
  const [detail, setDetail] = useState<CallRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function load() {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const data = await loadCallDetail(summary.id);
      if (data) setDetail(data);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    // Lazy-load the heavy body the first time this call is opened.
    if (next && !detail && !loading) void load();
  }

  // Gong/demo calls carry structured transcript_segments; manually-imported
  // calls carry only the plain-text `transcript` field (no segments). Only known
  // once the detail is loaded.
  const hasSegments = (detail?.transcript_segments.length ?? 0) > 0;

  const speakerById = (id: string) =>
    detail?.call_speakers.find((s) => s.id === id);

  const segments = detail
    ? filter === "signals"
      ? detail.transcript_segments.filter((s) => s.signals.length > 0)
      : detail.transcript_segments
    : [];

  return (
    <div className="rounded-lg border border-neutral-200 bg-card p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-caption uppercase tracking-wide text-primary-700 font-medium">
              {summary.call_type ?? t("callTypeFallback")}
            </span>
            <span className="text-caption text-neutral-400">·</span>
            <span className="text-caption text-neutral-500">
              {formatTime(summary.duration_seconds ?? 0)}
            </span>
            {summary.recorded_at && (
              <>
                <span className="text-caption text-neutral-400">·</span>
                <span className="text-caption text-neutral-500">
                  {new Date(summary.recorded_at).toLocaleDateString(
                    toBcp47(locale),
                  )}
                </span>
              </>
            )}
          </div>
          {summary.transcript_summary && (
            <p className="text-body leading-relaxed text-neutral-700">
              {summary.transcript_summary}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Signal filter only matters once segments are loaded. */}
          {open && detail && hasSegments && (
            <>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-md px-2.5 py-1 text-caption font-medium transition-colors ${
                  filter === "all"
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {t("filterAll")}
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
                {t("filterSignals")}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="rounded-md px-2.5 py-1 text-caption font-medium text-primary-700 transition-colors hover:bg-primary-50"
          >
            {open ? t("hideCall") : t("showCall")}
          </button>
        </div>
      </div>

      {open &&
        (loading ? (
          <p className="py-8 text-center text-small text-neutral-400">
            {t("loadingCall")}
          </p>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <p className="text-small text-danger-700">{t("loadCallError")}</p>
            <button
              type="button"
              onClick={load}
              className="rounded-md px-2.5 py-1 text-caption font-medium text-primary-700 transition-colors hover:bg-primary-50"
            >
              {t("retryCall")}
            </button>
          </div>
        ) : detail ? (
          hasSegments ? (
            <div className="max-h-[500px] space-y-3 overflow-y-auto pr-2">
              {segments.length === 0 ? (
                <p className="py-8 text-center text-small text-neutral-400">
                  {t("noSegments")}
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
                          : "border-neutral-200 bg-card"
                      }`}
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-caption font-medium ${
                              isSalesRep
                                ? "text-primary-700"
                                : "text-success-700"
                            }`}
                          >
                            {speaker?.name ?? t("speakerUnknown")}
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
          ) : detail.transcript ? (
            <div className="max-h-[500px] overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="whitespace-pre-wrap text-body leading-relaxed text-neutral-700">
                {detail.transcript}
              </p>
            </div>
          ) : (
            <p className="py-8 text-center text-small text-neutral-400">
              {t("noTranscript")}
            </p>
          )
        ) : null)}
    </div>
  );
}

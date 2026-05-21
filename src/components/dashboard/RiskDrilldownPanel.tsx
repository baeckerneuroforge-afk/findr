"use client";

import { useEffect, useState } from "react";
import { RiskSignalDrilldown } from "./RiskSignalDrilldown";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { RiskScoreRecord } from "@/lib/risk/service";

interface RiskDrilldownPanelProps {
  dealId: string | null;
  dealName?: string;
  open: boolean;
  onClose: () => void;
}

export function RiskDrilldownPanel({
  dealId,
  dealName,
  open,
  onClose,
}: RiskDrilldownPanelProps) {
  const [data, setData] = useState<RiskScoreRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !dealId) return;

    setLoading(true);
    setData(null);
    fetch(`/api/risk/latest?dealId=${encodeURIComponent(dealId)}`)
      .then((r) => r.json())
      .then((d) => setData(d.result))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, dealId]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-neutral-900/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-2xl overflow-y-auto border-l border-neutral-200 bg-white">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/95 backdrop-blur-xl px-6 py-4">
          <div className="min-w-0">
            <div className="mb-0.5 text-caption uppercase tracking-wider text-neutral-500">
              Risk drilldown
            </div>
            <div className="max-w-md truncate text-h2 text-neutral-900">
              {dealName ?? "Deal"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Close drilldown"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="space-y-4" aria-label="Loading risk analysis">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-5 w-40" />
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            </div>
          )}
          {!loading && !data && (
            <EmptyState
              icon={
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 0 0 2.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                  />
                </svg>
              }
              title="Not yet analyzed"
              description="Hit Analyze on the deal row to score it. The classifier reads the latest calls and CRM activity, then breaks the score into 8 signal categories."
              variant="subtle"
            />
          )}
          {!loading && data && (
            <div className="animate-fade-in-panel">
              <RiskSignalDrilldown
                riskScore={data.risk_score}
                riskLevel={data.risk_level}
                overallReasoning={data.overall_reasoning}
                recommendations={data.recommendations}
                signals={data.signals}
                analyzedAt={data.analyzed_at}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

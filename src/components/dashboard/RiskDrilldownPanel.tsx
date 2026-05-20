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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-obsidian border-l border-violet-500/20 z-50 overflow-y-auto">
        <div className="sticky top-0 bg-obsidian/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <div className="text-xs text-mist/50 uppercase tracking-wider mb-0.5">
              Risk Drilldown
            </div>
            <div className="text-lg font-semibold text-white truncate max-w-md">
              {dealName ?? "Deal"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-mist/60 hover:text-white transition-colors shrink-0"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="space-y-4" aria-label="Loading risk analysis">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-5 w-40" />
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
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
            <RiskSignalDrilldown
              riskScore={data.risk_score}
              riskLevel={data.risk_level}
              overallReasoning={data.overall_reasoning}
              recommendations={data.recommendations}
              signals={data.signals}
              analyzedAt={data.analyzed_at}
            />
          )}
        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { RiskSignalDrilldown } from "./RiskSignalDrilldown";
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
            <div className="text-center py-12 text-mist/50">
              Loading risk analysis...
            </div>
          )}
          {!loading && !data && (
            <div className="text-center py-12 text-mist/50">
              No risk analysis available yet.
              <br />
              <span className="text-xs">
                Click &ldquo;Analyze&rdquo; on the deal to generate one.
              </span>
            </div>
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

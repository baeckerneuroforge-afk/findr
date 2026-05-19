"use client";

import { useState } from "react";
import type { Deal, RiskAnalysisResult } from "@/lib/deals/types";
import DealRow from "./DealRow";
import { RiskDrilldownPanel } from "./RiskDrilldownPanel";

type ApiResponse =
  | { success: true; result: RiskAnalysisResult }
  | { error: string; detail?: string };

interface DealListProps {
  deals: Deal[];
}

export default function DealList({ deals: initialDeals }: DealListProps) {
  const [localDeals, setLocalDeals] = useState<Deal[]>(initialDeals);
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [drilldownDealId, setDrilldownDealId] = useState<string | null>(null);
  const [drilldownDealName, setDrilldownDealName] = useState<string>("");

  function openDrilldown(dealId: string, dealName: string) {
    setDrilldownDealId(dealId);
    setDrilldownDealName(dealName);
  }

  async function analyzeDeal(dealId: string): Promise<void> {
    setAnalyzing((prev) => new Set(prev).add(dealId));
    try {
      const res = await fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });
      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !("success" in data) || !data.success) {
        const detail =
          "detail" in data && data.detail ? data.detail : "Unknown error";
        console.error(`Risk analysis failed for ${dealId}:`, detail);
        return;
      }

      const { riskScore, riskLevel, signals, overallReasoning } = data.result;
      setLocalDeals((prev) =>
        prev.map((d) =>
          d.id === dealId
            ? {
                ...d,
                riskScore,
                riskLevel,
                riskSignals: signals.map((s) => s.type),
                riskReasoning: overallReasoning,
                lastRiskUpdate: new Date().toISOString(),
              }
            : d,
        ),
      );
    } catch (err) {
      console.error(`Risk analysis failed for ${dealId}:`, err);
    } finally {
      setAnalyzing((prev) => {
        const next = new Set(prev);
        next.delete(dealId);
        return next;
      });
    }
  }

  async function analyzeAll(): Promise<void> {
    setAnalyzingAll(true);
    // Sequential to respect Anthropic rate-limits
    for (const deal of localDeals) {
      await analyzeDeal(deal.id);
    }
    setAnalyzingAll(false);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-mist/15 bg-mist/5">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-mist/10 px-4 py-3">
        <p className="text-sm font-medium text-white">
          Deals
          <span className="ml-2 text-xs text-mist">
            ({localDeals.length})
          </span>
        </p>
        <button
          type="button"
          onClick={analyzeAll}
          disabled={analyzingAll || analyzing.size > 0}
          className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {analyzingAll ? "Analyzing all…" : "Analyze all"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-mist/10 bg-obsidian-light/40">
            <tr>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-mist">
                Deal
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-mist">
                Amount
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-mist">
                Stage
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-mist">
                Owner
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-mist">
                Last Activity
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-mist">
                Risk
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-mist">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {localDeals.map((deal) => (
              <DealRow
                key={deal.id}
                deal={deal}
                analyzing={analyzing.has(deal.id)}
                onAnalyze={() => analyzeDeal(deal.id)}
                onOpenDrilldown={() => openDrilldown(deal.id, deal.name)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <RiskDrilldownPanel
        dealId={drilldownDealId}
        dealName={drilldownDealName}
        open={drilldownDealId !== null}
        onClose={() => setDrilldownDealId(null)}
      />
    </div>
  );
}

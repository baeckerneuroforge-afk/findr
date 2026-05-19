"use client";

import { useRouter } from "next/navigation";
import type { Deal, DealStage } from "@/lib/deals/types";
import RiskBadge from "./RiskBadge";

interface DealRowProps {
  deal: Deal;
  analyzing: boolean;
  onAnalyze: () => void;
  onOpenDrilldown?: () => void;
}

const STAGE_LABELS: Record<DealStage, string> = {
  qualified: "Qualified",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  verbal_commit: "Verbal commit",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
};

function formatAmount(amount: number, currency: "USD" | "EUR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DealRow({
  deal,
  analyzing,
  onAnalyze,
  onOpenDrilldown,
}: DealRowProps) {
  const router = useRouter();
  const stale = deal.daysSinceLastActivity > 14;
  const alreadyScored = deal.riskScore !== undefined;

  return (
    <tr
      onClick={() => router.push(`/dashboard/deals/${deal.id}`)}
      className="border-b border-mist/10 last:border-b-0 cursor-pointer transition-colors hover:bg-white/[0.02]"
    >
      {/* Deal name + company */}
      <td className="px-4 py-4">
        <p className="font-medium text-white">{deal.name}</p>
        <p className="mt-0.5 text-xs text-mist">{deal.companyName}</p>
      </td>

      {/* Amount */}
      <td className="px-4 py-4 text-sm text-white whitespace-nowrap">
        {formatAmount(deal.amount, deal.currency)}
      </td>

      {/* Stage */}
      <td className="px-4 py-4">
        <span className="inline-flex rounded bg-mist/10 px-2 py-1 text-xs text-mist">
          {STAGE_LABELS[deal.stage]}
        </span>
      </td>

      {/* Owner */}
      <td className="px-4 py-4 text-sm text-mist whitespace-nowrap">
        {deal.ownerName}
      </td>

      {/* Last activity */}
      <td
        className={`px-4 py-4 text-sm whitespace-nowrap ${
          stale ? "text-alert-400" : "text-mist"
        }`}
      >
        {deal.daysSinceLastActivity === 0
          ? "Today"
          : `${deal.daysSinceLastActivity} days ago`}
      </td>

      {/* Risk badge — click to open drilldown panel */}
      <td className="px-4 py-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDrilldown?.();
          }}
          className="hover:opacity-80 transition-opacity"
        >
          <RiskBadge score={deal.riskScore} level={deal.riskLevel} size="sm" />
        </button>
      </td>

      {/* Action — stop row click when pressing button */}
      <td className="px-4 py-4 text-right">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAnalyze();
          }}
          disabled={analyzing}
          className="rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {analyzing ? "Analyzing…" : alreadyScored ? "Re-analyze" : "Analyze"}
        </button>
      </td>
    </tr>
  );
}

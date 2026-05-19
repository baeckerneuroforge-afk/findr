import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getDealById } from "@/lib/deals/service";
import { getCallsByDealId } from "@/lib/calls/service";
import { CallDetail } from "@/components/dashboard/CallDetail";
import { RiskBadge } from "@/components/dashboard/RiskBadge";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const deal = await getDealById(id);
  if (!deal) notFound();

  const calls = await getCallsByDealId(id);

  return (
    <div className="min-h-screen bg-obsidian text-white">
      <div className="p-8 max-w-6xl mx-auto">
        <Link
          href="/dashboard"
          className="text-sm text-mist/60 hover:text-white mb-4 inline-block"
        >
          ← Back to dashboard
        </Link>

        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{deal.name}</h1>
            <div className="flex items-center gap-3 text-sm text-mist/60 flex-wrap">
              <span>{deal.stage}</span>
              <span>·</span>
              <span>
                {new Intl.NumberFormat("de-DE", {
                  style: "currency",
                  currency: deal.currency,
                  maximumFractionDigits: 0,
                }).format(deal.amount)}
              </span>
              <span>·</span>
              <span>Champion: {deal.championName}</span>
            </div>
          </div>
          <RiskBadge level={deal.riskLevel} score={deal.riskScore} size="large" />
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Call History ({calls.length})
          </h2>
          <div className="space-y-4">
            {calls.length === 0 ? (
              <div className="text-center py-12 text-mist/40 border border-white/5 rounded-2xl">
                No calls yet for this deal.
                <p className="text-xs text-mist/30 mt-2">
                  Run{" "}
                  <code className="text-violet-300">
                    pnpm tsx src/scripts/seed-calls.ts
                  </code>{" "}
                  to populate.
                </p>
              </div>
            ) : (
              calls.map((call) => <CallDetail key={call.id} call={call} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

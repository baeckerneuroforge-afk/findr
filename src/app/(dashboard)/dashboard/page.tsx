import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DealList from "@/components/dashboard/DealList";
import { getDealsByOrg } from "@/lib/deals/service";

export default async function DashboardPage() {
  const { userId, orgId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const deals = await getDealsByOrg(orgId ?? "mock");
  const atRiskCount = deals.filter(
    (d) => d.riskScore !== undefined && d.riskScore > 60,
  ).length;

  const stats: { label: string; value: string; subtitle?: string }[] = [
    { label: "Active Deals", value: String(deals.length) },
    {
      label: "At Risk",
      value: String(atRiskCount),
      subtitle: atRiskCount === 0 ? "Run analyze to populate" : undefined,
    },
    { label: "Saved by Findr", value: "0" },
    { label: "Loss Patterns", value: "0" },
  ];

  return (
    <div className="min-h-screen bg-obsidian text-white">
      <DashboardSidebar />
      <DashboardHeader title="Dashboard" />

      <main className="min-h-screen pl-60 pt-16">
        <div className="p-8">
          {/* Stats row */}
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-mist/15 bg-mist/5 p-5"
              >
                <p className="text-xs uppercase tracking-wider text-mist">
                  {stat.label}
                </p>
                <p className="mt-2 text-3xl font-medium text-white">
                  {stat.value}
                </p>
                {stat.subtitle && (
                  <p className="mt-1 text-xs text-mist">{stat.subtitle}</p>
                )}
              </div>
            ))}
          </div>

          {/* Deals table */}
          <DealList deals={deals} />
        </div>
      </main>
    </div>
  );
}

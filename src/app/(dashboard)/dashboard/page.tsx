import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import EmptyState from "@/components/dashboard/EmptyState";

const STATS: { label: string; value: string; subtitle?: string }[] = [
  { label: "Active Deals", value: "—", subtitle: "Connect CRM to see" },
  { label: "At Risk", value: "—" },
  { label: "Saved by Findr", value: "—" },
  { label: "Loss Patterns", value: "—" },
];

function LinkIcon() {
  return (
    <svg
      className="h-12 w-12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
      />
    </svg>
  );
}

export default async function DashboardPage() {
  // Defense-in-depth: middleware already protects /dashboard, but verify here too.
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-obsidian text-white">
      <DashboardSidebar />
      <DashboardHeader title="Dashboard" />

      <main className="min-h-screen pl-60 pt-16">
        <div className="p-8">
          {/* Stats row */}
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
            {STATS.map((stat) => (
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

          {/* Empty state */}
          <EmptyState
            icon={<LinkIcon />}
            title="Connect your CRM to start"
            description="Findr analyzes your deals and sales calls to detect loss-risk patterns. Connect Hubspot or Salesforce to begin."
            cta={{ label: "Connect Hubspot", href: "#connect-hubspot" }}
          />
        </div>
      </main>
    </div>
  );
}

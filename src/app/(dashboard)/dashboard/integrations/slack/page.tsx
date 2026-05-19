import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { getSlackIntegration } from "@/lib/slack/service";
import { SlackSettingsForm } from "@/components/dashboard/SlackSettingsForm";

export default async function SlackIntegrationPage() {
  let orgId: string;
  try {
    orgId = await requireOrgId();
  } catch (err) {
    if (err instanceof OrgResolutionError) {
      if (err.code === "no_auth") redirect("/sign-in");
      if (err.code === "no_org") redirect("/sign-in");
      redirect("/sign-in");
    }
    throw err;
  }

  const integration = await getSlackIntegration(orgId);

  return (
    <div className="min-h-screen bg-obsidian text-white">
      <DashboardSidebar />
      <DashboardHeader title="Slack Alerts" />

      <main className="min-h-screen pl-60 pt-16">
        <div className="p-8 max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Slack Integration
            </h1>
            <p className="text-mist/70 text-sm">
              Push risk alerts to a Slack channel when deals are at risk.
            </p>
          </div>

          <SlackSettingsForm initialIntegration={integration} />
        </div>
      </main>
    </div>
  );
}

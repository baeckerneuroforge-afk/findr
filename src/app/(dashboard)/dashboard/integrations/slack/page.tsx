import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { getSlackIntegration } from "@/lib/slack/service";
import { SlackSettingsForm } from "@/components/dashboard/SlackSettingsForm";

const FINDR_DEV_ORG_ID = "4909c8ee-017f-4d9a-bdb6-d3b90f0806a0";

export default async function SlackIntegrationPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const integration = await getSlackIntegration(FINDR_DEV_ORG_ID);

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

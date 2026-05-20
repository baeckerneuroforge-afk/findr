import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import {
  getSlackAlertHistory,
  getSlackAlertPreferences,
} from "@/lib/alerts/service";
import { getSlackIntegration } from "@/lib/slack/service";
import { AlertHistoryPanel } from "@/components/dashboard/AlertHistoryPanel";
import { SlackSettingsForm } from "@/components/dashboard/SlackSettingsForm";

export default async function SlackIntegrationPage() {
  let orgId: string;
  try {
    orgId = await requireOrgId();
  } catch (err) {
    if (err instanceof OrgResolutionError) {
      if (err.code === "no_auth") redirect("/sign-in");
      if (err.code === "no_org") redirect("/onboarding/create-org");
      redirect("/sign-in");
    }
    throw err;
  }

  const integration = await getSlackIntegration(orgId);
  const [preferences, alertHistory] = await Promise.all([
    getSlackAlertPreferences(orgId),
    getSlackAlertHistory(orgId, 20),
  ]);

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-display text-neutral-900 mb-1">Slack alerts</h1>
        <p className="text-body text-neutral-500">
          Push risk alerts to a Slack channel when deals are at risk.
        </p>
      </div>
      <div className="space-y-8">
        <SlackSettingsForm
          initialIntegration={integration}
          initialPreferences={preferences}
        />
        <AlertHistoryPanel alerts={alertHistory} />
      </div>
    </div>
  );
}

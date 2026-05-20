import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { getHubspotIntegration } from "@/lib/hubspot/service";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { HubspotSettingsPanel } from "@/components/dashboard/HubspotSettingsPanel";

export default async function HubspotIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  let orgId: string;
  try {
    orgId = await requireOrgId();
  } catch (err) {
    if (err instanceof OrgResolutionError) {
      if (err.code === "no_auth") redirect("/sign-in");
      if (err.code === "no_org") redirect("/?need_org=1");
      redirect("/sign-in");
    }
    throw err;
  }

  const params = await searchParams;
  const integration = await getHubspotIntegration(orgId);

  return (
    <div className="min-h-screen bg-obsidian text-white">
      <DashboardSidebar />
      <DashboardHeader title="Hubspot Integration" />

      <main className="min-h-screen pl-60 pt-16">
        <div className="mx-auto max-w-3xl p-8">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold text-white">
              Hubspot Integration
            </h1>
            <p className="text-sm text-mist/70">
              Sync deals, companies, and owners from your Hubspot CRM into
              Findr.
            </p>
          </div>

          <HubspotSettingsPanel
            initialIntegration={integration}
            connectedFlag={params.connected === "true"}
            errorFlag={params.error}
          />
        </div>
      </main>
    </div>
  );
}

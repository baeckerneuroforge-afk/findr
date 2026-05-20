import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { getHubspotIntegration } from "@/lib/hubspot/service";
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
      if (err.code === "no_org") redirect("/onboarding/create-org");
      redirect("/sign-in");
    }
    throw err;
  }

  const params = await searchParams;
  const integration = await getHubspotIntegration(orgId);

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-display text-neutral-900 mb-1">
          Hubspot integration
        </h1>
        <p className="text-body text-neutral-500">
          Sync deals, companies, and owners from your Hubspot CRM into Findr.
        </p>
      </div>
      <HubspotSettingsPanel
        initialIntegration={integration}
        connectedFlag={params.connected === "true"}
        errorFlag={params.error}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { getGongIntegration, isGongConfigured } from "@/lib/gong/service";
import { GongSettingsPanel } from "@/components/dashboard/GongSettingsPanel";
import { ENABLED_MODULES } from "@/config/modules";

export default async function GongIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  if (!ENABLED_MODULES.salesIntelligence) redirect("/dashboard");

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
  const integration = await getGongIntegration(orgId);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-display text-neutral-900">Gong Integration</h1>
        <p className="mt-1 text-body text-neutral-500">
          Sync call recordings and transcripts from Gong into Findr.
        </p>
      </div>

      <GongSettingsPanel
        initialIntegration={integration}
        connectedFlag={params.connected === "true"}
        errorFlag={params.error}
        configured={isGongConfigured()}
      />
    </div>
  );
}

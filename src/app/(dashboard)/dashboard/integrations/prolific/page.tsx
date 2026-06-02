import { redirect } from "next/navigation";

import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { getProlificCredentialSummary } from "@/lib/panel/service";
import { ProlificSettingsPanel } from "@/components/dashboard/ProlificSettingsPanel";

export default async function ProlificIntegrationPage() {
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

  const credential = await getProlificCredentialSummary(orgId);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-display text-neutral-900">Prolific Integration</h1>
        <p className="mt-1 text-body text-neutral-500">
          Store the organization Prolific token for draft study creation.
        </p>
      </div>

      <ProlificSettingsPanel initialCredential={credential} />
    </div>
  );
}

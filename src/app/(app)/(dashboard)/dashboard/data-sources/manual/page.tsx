import Link from "next/link";
import { redirect } from "next/navigation";
import { ManualImportFlow } from "@/components/dashboard/ManualImportFlow";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { ENABLED_MODULES } from "@/config/modules";

export default async function ManualImportPage() {
  if (!ENABLED_MODULES.salesIntelligence) redirect("/dashboard");

  try {
    await requireOrgId();
  } catch (err) {
    if (err instanceof OrgResolutionError) {
      if (err.code === "no_auth") redirect("/sign-in");
      if (err.code === "no_org") redirect("/onboarding/create-org");
      redirect("/sign-in");
    }
    throw err;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/data-sources"
          className="mb-3 inline-flex text-small text-neutral-500 hover:text-neutral-900"
        >
          ← Back to Data Sources
        </Link>
        <h1 className="text-display text-neutral-900">Manual import</h1>
        <p className="mt-1 max-w-2xl text-body text-neutral-500">
          Create a deal, paste call transcripts, and run a real Klymeo risk
          analysis without waiting for Hubspot or Gong setup.
        </p>
      </div>

      <ManualImportFlow />
    </div>
  );
}

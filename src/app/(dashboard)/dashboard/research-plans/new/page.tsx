import Link from "next/link";
import { redirect } from "next/navigation";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { ResearchPlanForm } from "@/components/dashboard/ResearchPlanForm";

/**
 * /dashboard/research-plans/new — Plan-Anlage.
 *
 * Server-rendered shell + client-rendered form. Auth ist server-side
 * (requireOrgId) — wenn man hier durchkommt, ist der User in einer Org.
 * Die POST-Route prüft das nochmal serverseitig, also kein Spoofing-Risiko
 * trotz der Trennung.
 */

export default async function NewResearchPlanPage() {
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
        <div className="mb-2">
          <Link
            href="/dashboard/research-plans"
            className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
          >
            ← All research plans
          </Link>
        </div>
        <h1 className="text-display text-neutral-900">New research plan</h1>
        <p className="mt-1 text-body text-neutral-500">
          Define the objective and the topics. The agent formulates questions
          on-the-fly — you describe what to learn, not the exact wording.
        </p>
      </div>

      <ResearchPlanForm />
    </div>
  );
}

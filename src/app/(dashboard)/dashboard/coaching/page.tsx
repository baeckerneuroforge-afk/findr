import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { getRepCoachingProfiles } from "@/lib/coaching/service";
import { CoachingDashboard } from "@/components/dashboard/CoachingDashboard";

export default async function CoachingPage() {
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

  const profiles = await getRepCoachingProfiles(orgId);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-display text-neutral-900 mb-1">Team coaching</h1>
        <p className="text-body text-neutral-500">
          Loss patterns and coaching recommendations per sales rep.
        </p>
      </div>
      <CoachingDashboard profiles={profiles} />
    </div>
  );
}

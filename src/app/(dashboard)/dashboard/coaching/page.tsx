import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { getRepCoachingProfiles } from "@/lib/coaching/service";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { CoachingDashboard } from "@/components/dashboard/CoachingDashboard";

export default async function CoachingPage() {
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

  const profiles = await getRepCoachingProfiles(orgId);

  return (
    <div className="min-h-screen bg-obsidian text-white">
      <DashboardSidebar />
      <DashboardHeader title="Team Coaching" />

      <main className="min-h-screen pl-60 pt-16">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold text-white">
              Team Coaching
            </h1>
            <p className="text-sm text-mist/70">
              Loss patterns and coaching recommendations per sales rep.
            </p>
          </div>

          <CoachingDashboard profiles={profiles} />
        </div>
      </main>
    </div>
  );
}

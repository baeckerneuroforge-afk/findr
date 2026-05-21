import { OrganizationProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { findrDashboardClerkAppearance } from "@/lib/clerk/dashboard-appearance";
import { isAdminRole } from "@/lib/settings/roles";

export default async function TeamSettingsPage() {
  const { orgRole } = await auth();
  const isAdmin = isAdminRole(orgRole);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-h2 text-neutral-900">Team</h2>
        <p className="mt-1 text-body text-neutral-500">
          Manage members, invitations, and organization roles through Clerk.
        </p>
      </div>
      {isAdmin ? (
        <OrganizationProfile
          routing="hash"
          appearance={findrDashboardClerkAppearance}
        />
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white p-5 text-body text-neutral-500">
          Only organization admins can manage members, invitations, and roles.
        </div>
      )}
    </div>
  );
}

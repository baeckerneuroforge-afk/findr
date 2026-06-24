import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { KlymeoMark } from "@/components/shared/KlymeoMark";

/**
 * Post-login landing for the rare case a signed-in Zitadel user is not yet
 * assigned to an organization. With "one customer = one Zitadel org", workspaces
 * are provisioned in Zitadel and auto-mirrored on first login (see requireOrgId),
 * so in-app org creation was retired — a user who already has an org is sent
 * straight to the dashboard. proxy.ts has already gated this route to signed-in
 * users.
 */
export default async function CreateOrgPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  if (session.user.orgId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-5 flex justify-center">
          <KlymeoMark className="h-10 w-10" />
        </div>
        <h1 className="text-display text-neutral-900 mb-2">
          No workspace assigned yet
        </h1>
        <p className="text-body text-neutral-500">
          Your account isn&apos;t part of an organization yet. Your Klymeo
          workspace is provisioned in Zitadel — please ask your administrator to
          add you to your organization, then sign in again.
        </p>
      </div>
    </div>
  );
}

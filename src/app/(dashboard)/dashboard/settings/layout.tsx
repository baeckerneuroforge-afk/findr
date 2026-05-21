import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { SettingsNav } from "@/components/settings/SettingsNav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <h1 className="text-display text-neutral-900">Settings</h1>
        <p className="mt-1 text-body text-neutral-500">
          Manage your account, workspace, team, data, and plan.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white">
        <SettingsNav />
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

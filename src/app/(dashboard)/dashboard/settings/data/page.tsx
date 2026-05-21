import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireOrgId } from "@/lib/auth/org";
import { isAdminRole } from "@/lib/settings/roles";
import { DataPrivacyPanel } from "@/components/settings/DataPrivacyPanel";

export default async function DataPrivacySettingsPage() {
  const orgId = await requireOrgId();
  const { orgRole } = await auth();
  const supabase = createAdminSupabaseClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-h2 text-neutral-900">Data & Privacy</h2>
        <p className="mt-1 text-body text-neutral-500">
          DSGVO-ready export and deletion controls for organization data.
        </p>
      </div>
      <DataPrivacyPanel
        isAdmin={isAdminRole(orgRole)}
        organizationName={org?.name ?? "Organization"}
      />
    </div>
  );
}

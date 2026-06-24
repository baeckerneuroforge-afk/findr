import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireOrgId } from "@/lib/auth/org";
import { hasAdminRole } from "@/lib/settings/roles";
import { getInterviewRetentionDays } from "@/lib/settings/org-settings";
import { DataPrivacyPanel } from "@/components/settings/DataPrivacyPanel";

export default async function DataPrivacySettingsPage() {
  const orgId = await requireOrgId();
  const session = await auth();
  const t = await getTranslations("settings");
  const supabase = createAdminSupabaseClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();
  const retentionDays = await getInterviewRetentionDays(orgId);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-h2 text-neutral-900">{t("data.title")}</h2>
        <p className="mt-1 text-body text-neutral-500">{t("data.subtitle")}</p>
      </div>
      <DataPrivacyPanel
        isAdmin={hasAdminRole(session?.user?.roles)}
        organizationName={org?.name ?? "Organization"}
        initialRetentionDays={retentionDays}
      />
    </div>
  );
}

import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { ThemedOrganizationProfile } from "@/components/settings/ThemedClerkProfile";
import { isAdminRole } from "@/lib/settings/roles";

export default async function TeamSettingsPage() {
  const { orgRole } = await auth();
  const isAdmin = isAdminRole(orgRole);
  const t = await getTranslations("settings");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-h2 text-neutral-900">{t("team.title")}</h2>
        <p className="mt-1 text-body text-neutral-500">{t("team.subtitle")}</p>
      </div>
      {isAdmin ? (
        <ThemedOrganizationProfile />
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-card p-5 text-body text-neutral-500">
          {t("team.adminOnly")}
        </div>
      )}
    </div>
  );
}

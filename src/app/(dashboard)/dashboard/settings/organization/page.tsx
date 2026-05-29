import { getTranslations } from "next-intl/server";
import { OrganizationSettingsForm } from "@/components/settings/OrganizationSettingsForm";
import { AutoInterviewSettingForm } from "@/components/settings/AutoInterviewSettingForm";

export default async function OrganizationSettingsPage() {
  const t = await getTranslations("settings");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-h2 text-neutral-900">{t("organization.title")}</h2>
        <p className="mt-1 text-body text-neutral-500">
          {t("organization.subtitle")}
        </p>
      </div>
      <OrganizationSettingsForm />
      <AutoInterviewSettingForm />
    </div>
  );
}

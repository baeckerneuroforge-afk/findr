import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { zitadelConsoleUrl } from "@/lib/auth/zitadel";
import { OrganizationSettingsForm } from "@/components/settings/OrganizationSettingsForm";
import { AutoInterviewSettingForm } from "@/components/settings/AutoInterviewSettingForm";
import { BrandingSettingsForm } from "@/components/settings/BrandingSettingsForm";
import { BusinessContextSettingForm } from "@/components/settings/BusinessContextSettingForm";

export default async function OrganizationSettingsPage() {
  const t = await getTranslations("settings");
  const session = await auth();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-h2 text-neutral-900">{t("organization.title")}</h2>
        <p className="mt-1 text-body text-neutral-500">
          {t("organization.subtitle")}
        </p>
      </div>
      <OrganizationSettingsForm
        orgName={session?.user?.orgName ?? null}
        orgId={session?.user?.orgId ?? null}
        consoleUrl={zitadelConsoleUrl()}
      />
      <BusinessContextSettingForm />
      <AutoInterviewSettingForm />
      <BrandingSettingsForm />
    </div>
  );
}

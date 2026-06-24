import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { ZitadelConsoleCard } from "@/components/settings/ZitadelConsoleCard";
import { zitadelConsoleUrl } from "@/lib/auth/zitadel";

export default async function ProfileSettingsPage() {
  const t = await getTranslations("settings");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-h2 text-neutral-900">{t("profile.title")}</h2>
        <p className="mt-1 text-body text-neutral-500">
          {t("profile.subtitle")}
        </p>
      </div>
      <LanguageSwitcher variant="settings" />
      <ThemeSwitcher variant="settings" />
      <ZitadelConsoleCard
        title={t("profile.consoleTitle")}
        description={t("profile.consoleDescription")}
        linkLabel={t("orgForm.manageInZitadel")}
        href={zitadelConsoleUrl()}
      />
    </div>
  );
}

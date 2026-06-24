import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";
import { ZitadelConsoleCard } from "@/components/settings/ZitadelConsoleCard";
import { zitadelConsoleUrl } from "@/lib/auth/zitadel";
import { hasAdminRole } from "@/lib/settings/roles";

export default async function TeamSettingsPage() {
  const session = await auth();
  const isAdmin = hasAdminRole(session?.user?.roles);
  const t = await getTranslations("settings");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-h2 text-neutral-900">{t("team.title")}</h2>
        <p className="mt-1 text-body text-neutral-500">{t("team.subtitle")}</p>
      </div>
      {isAdmin ? (
        <ZitadelConsoleCard
          title={t("team.consoleTitle")}
          description={t("team.consoleDescription")}
          linkLabel={t("orgForm.manageInZitadel")}
          href={zitadelConsoleUrl()}
        />
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-card p-5 text-body text-neutral-500">
          {t("team.adminOnly")}
        </div>
      )}
    </div>
  );
}

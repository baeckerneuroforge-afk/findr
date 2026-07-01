import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { ScopedMessages } from "@/components/i18n/ScopedMessages";

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

  const t = await getTranslations("settings");

  return (
    // i18n-Sektions-Provider (Perf-Split, src/i18n/client-messages.ts):
    // "branding" für das BrandingSettingsForm unter /settings/organization;
    // "settings" selbst ist Teil des Root-Kerns (UserMenu im Header).
    <ScopedMessages namespaces={["branding"]}>
    <div className="space-y-8">
      <div>
        <h1 className="text-display text-neutral-900">{t("title")}</h1>
        <p className="mt-1 text-body text-neutral-500">{t("subtitle")}</p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-card">
        <SettingsNav />
        <div className="p-5">{children}</div>
      </div>
    </div>
    </ScopedMessages>
  );
}

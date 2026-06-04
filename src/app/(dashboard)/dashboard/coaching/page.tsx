import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { getRepCoachingProfiles } from "@/lib/coaching/service";
import { CoachingDashboard } from "@/components/dashboard/CoachingDashboard";
import { ENABLED_MODULES } from "@/config/modules";

export default async function CoachingPage() {
  if (!ENABLED_MODULES.salesIntelligence) redirect("/dashboard");

  let orgId: string;
  try {
    orgId = await requireOrgId();
  } catch (err) {
    if (err instanceof OrgResolutionError) {
      if (err.code === "no_auth") redirect("/sign-in");
      if (err.code === "no_org") redirect("/onboarding/create-org");
      redirect("/sign-in");
    }
    throw err;
  }

  const t = await getTranslations("sales.coaching");
  const profiles = await getRepCoachingProfiles(orgId);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-display text-neutral-900 mb-1">{t("title")}</h1>
        <p className="text-body text-neutral-500">{t("subtitle")}</p>
      </div>
      <CoachingDashboard profiles={profiles} />
    </div>
  );
}

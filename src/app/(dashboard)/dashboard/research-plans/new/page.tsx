import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { ResearchPlanForm } from "@/components/dashboard/ResearchPlanForm";
import { ENABLED_MODULES } from "@/config/modules";

/**
 * /dashboard/research-plans/new — Plan-Anlage.
 *
 * Server-rendered shell + client-rendered form. Auth ist server-side
 * (requireOrgId) — wenn man hier durchkommt, ist der User in einer Org.
 * Die POST-Route prüft das nochmal serverseitig, also kein Spoofing-Risiko
 * trotz der Trennung.
 */

export default async function NewResearchPlanPage() {
  if (!ENABLED_MODULES.productDiscovery) redirect("/dashboard");

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

  const t = await getTranslations("research.plans");

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2">
          <Link
            href="/dashboard/research-plans"
            className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
          >
            {t("backAll")}
          </Link>
        </div>
        <h1 className="text-display text-neutral-900">{t("newTitle")}</h1>
        <p className="mt-1 text-body text-neutral-500">{t("newSubtitle")}</p>
      </div>

      <ResearchPlanForm />
    </div>
  );
}

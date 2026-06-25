import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { ResearchPlanForm } from "@/components/dashboard/ResearchPlanForm";
import { getLiveKitVoiceEnv } from "@/lib/voice-interview/livekit";

/**
 * /dashboard/market-research/new/classic — die klassische Markt-Studien-Form.
 *
 * Fallback zum gefuehrten Wizard (…/new): dieselbe bewährte ResearchPlanForm
 * mit studyType="market_research", unverändert. Für Power-Use-Cases (z. B.
 * Datei-Stimulus-Upload, mehrere Assets) und als Sicherheit, falls der Wizard
 * etwas nicht abdeckt. Bewusst nicht aus der Nav verlinkt — nur über den
 * „klassische Form"-Link auf der Wizard-Seite erreichbar.
 */
export default async function NewMarketCampaignClassicPage() {
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

  const t = await getTranslations("research.market");

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2">
          <Link
            href="/dashboard/market-research/new"
            className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
          >
            ← {t("newTitle")}
          </Link>
        </div>
        <h1 className="text-display text-neutral-900">{t("newTitle")}</h1>
        <p className="mt-1 text-body text-neutral-500">{t("newSubtitle")}</p>
      </div>

      <ResearchPlanForm
        studyType="market_research"
        voiceAvailable={getLiveKitVoiceEnv() !== null}
      />
    </div>
  );
}

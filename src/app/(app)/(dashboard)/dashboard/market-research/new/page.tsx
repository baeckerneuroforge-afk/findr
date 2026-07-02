import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { GuidedStudyWizard } from "@/components/dashboard/guided-study/GuidedStudyWizard";
import { getOrgBusinessContext } from "@/lib/settings/org-settings";
import { getLiveKitVoiceEnv } from "@/lib/voice-interview/livekit";

/**
 * /dashboard/market-research/new — Markt-Studie anlegen.
 *
 * Der gefuehrte 4-Schritt-Wizard (GuidedStudyWizard) ist hier der echte
 * Anlege-Flow: Briefing → KI-Vorschlag → Interview → Start, gegen die echten
 * Endpunkte (POST /api/research/plans, POST …/[id]/guide, PATCH …/[id]). Die
 * vollständige klassische Form bleibt als Fallback unter …/new/classic
 * erreichbar (verlinkt oben rechts) — es geht keine Funktion verloren.
 */
export default async function NewMarketCampaignPage() {
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

  const t = await getTranslations("research.market");
  const tw = await getTranslations("research.wizard");
  // E3 — Org-Profil-Kontext SERVER-seitig laden und als Initialwert reingeben:
  // Prefill steht beim ersten Paint, kein Client-Fetch, kein Race mit dem
  // Tippen/Generieren. Fail-open (null = kein Prefill).
  const initialBusinessContext = await getOrgBusinessContext(orgId);

  return (
    <div className="space-y-8">
      <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <Link
            href="/dashboard/market-research"
            className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
          >
            {t("backToCampaigns")}
          </Link>
          <Link
            href="/dashboard/market-research/new/classic"
            className="text-small text-neutral-400 transition-colors hover:text-neutral-700"
          >
            {tw("classicCta")} →
          </Link>
        </div>
        <h1 className="text-display text-neutral-900">{t("newTitle")}</h1>
        <p className="mt-1 text-body text-neutral-500">{t("newSubtitle")}</p>
      </div>

      {/* Server-seitiger Env-Check: ohne LiveKit ist die Voice-Karte im Wizard
          deaktiviert (statt 503 beim Teilnehmer). */}
      <div className="st-rise" style={{ "--st": 1 } as React.CSSProperties}>
        <GuidedStudyWizard
          voiceAvailable={getLiveKitVoiceEnv() !== null}
          initialBusinessContext={initialBusinessContext}
        />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { loadOrgSyntheses } from "@/lib/mission-control/engine";
import { CrossStudyAgentPanel } from "@/components/dashboard/CrossStudyAgentPanel";

/**
 * /dashboard/insights — cross-study surface. The "Chat" mode was removed: the org
 * keeps only the more capable Cross-Study-Agent (Konsoul) here, so this page now
 * renders <CrossStudyAgentPanel /> directly (no mode switcher). The agent does
 * multi-step research — lists studies, loads the relevant ones on demand, counts
 * exactly, and compares — before answering.
 *
 * Org-level (NOT inside a single study): ask questions ACROSS ALL of the org's
 * study syntheses and get answers with per-study verbatim citations that link
 * back to each source study's synthesis; the engine owns its own
 * anti-hallucination per-study anchor filter.
 *
 * Study titles come from the canonical loadOrgSyntheses() — the SAME read path
 * the engine uses per question, so there is no parallel data path. We keep only
 * the {studyId, studyTitle} the panel needs for the source links; the synthesis
 * content itself is re-loaded + re-anchored by the engine on every turn.
 *
 * Auth mirrors the synthesis page: requireOrgId(), redirect on no_auth/no_org.
 * The panel is session-local (no persistence).
 */

export default async function InsightsPage() {
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

  const syntheses = await loadOrgSyntheses(orgId);
  const studies = syntheses.map((s) => ({
    studyId: s.studyId,
    studyTitle: s.studyTitle,
  }));

  const t = await getTranslations("missionControl");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display text-neutral-900">{t("pageTitle")}</h1>
        <p className="mt-1 text-body text-neutral-500">{t("pageIntro")}</p>
      </div>

      <CrossStudyAgentPanel studies={studies} />
    </div>
  );
}

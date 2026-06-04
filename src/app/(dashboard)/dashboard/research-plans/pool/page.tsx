import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { listPoolMembers } from "@/lib/research/participant-pool";
import { ParticipantPoolManager } from "@/components/dashboard/ParticipantPoolManager";
import { ENABLED_MODULES } from "@/config/modules";

/**
 * /dashboard/research-plans/pool — Teilnehmer-Pool-Surface.
 *
 * Statischer Geschwister-Pfad neben /research-plans/[id] und /research-plans/
 * new (Next.js bevorzugt statische Segmente vor [id], daher kein Konflikt).
 * Pure-read Server-Component nach dem Muster des Plan-Index: requireOrgId mit
 * dem etablierten Redirect-Kontrakt, dann den org-weiten Pool laden und an die
 * Client-Manager-Komponente übergeben (die CRUD + Filtern client-seitig hält).
 */
export default async function ParticipantPoolPage() {
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

  const members = await listPoolMembers(orgId);
  const t = await getTranslations("research.pool");
  const backHref = ENABLED_MODULES.productDiscovery
    ? "/dashboard/research-plans"
    : "/dashboard/market-research";

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2">
          <Link
            href={backHref}
            className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
          >
            {t("back")}
          </Link>
        </div>
        <h1 className="text-display text-neutral-900">{t("title")}</h1>
        <p className="mt-1 text-body text-neutral-500">{t("subtitle")}</p>
      </div>

      <ParticipantPoolManager initialMembers={members} />
    </div>
  );
}

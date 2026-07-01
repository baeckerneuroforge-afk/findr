import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { toBcp47 } from "@/i18n/locale";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { loadOrgSyntheses } from "@/lib/mission-control/engine";
import { listMetaSyntheses } from "@/lib/meta-synthesis/service";
import { MetaSynthesisCreator } from "@/components/dashboard/MetaSynthesisCreator";

/**
 * /dashboard/insights/meta-synthesis — the dedicated meta-synthesis entry
 * (André's "beides"): a study picker to compare ≥2 syntheses into a deep,
 * exportable artifact, plus the list of already-created artifacts.
 *
 * The Cross-Study chat CTA deep-links here with ?studies=<comma-ids>&focus=<q> so
 * the picker opens PRE-SELECTED with the studies the chat answer cited. Both
 * entry points converge on <MetaSynthesisCreator /> → POST /api/meta-synthesis.
 *
 * Auth mirrors the insights page: requireOrgId(), redirect on no_auth/no_org.
 * Studies come from the canonical loadOrgSyntheses() — no parallel data path.
 */

export default async function MetaSynthesisListPage({
  searchParams,
}: {
  searchParams: Promise<{ studies?: string; focus?: string }>;
}) {
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

  const [syntheses, records] = await Promise.all([
    loadOrgSyntheses(orgId),
    listMetaSyntheses(orgId),
  ]);
  const studies = syntheses.map((s) => ({
    studyId: s.studyId,
    studyTitle: s.studyTitle,
    basedOnCount: s.basedOnCount,
  }));

  const { studies: rawStudies, focus: rawFocus } = await searchParams;
  const initialSelected = (rawStudies ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  const initialFocus = (rawFocus ?? "").trim() || undefined;

  const t = await getTranslations("metaSynthesis");
  const dateFmt = new Intl.DateTimeFormat(toBcp47(await getLocale()), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/insights"
          className="text-small font-medium text-primary-700 transition-colors hover:underline"
        >
          ← {t("navLink")}
        </Link>
      </div>

      <MetaSynthesisCreator
        studies={studies}
        initialSelected={initialSelected}
        initialFocus={initialFocus}
      />

      <section className="space-y-3">
        <h2 className="text-h3 text-neutral-900">{t("listTitle")}</h2>
        {records.length === 0 ? (
          <p className="text-body text-neutral-500">{t("listEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {records.map((record) => (
              <li key={record.id}>
                <Link
                  href={`/dashboard/insights/meta-synthesis/${record.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-card p-4 transition-colors hover:border-primary-300 hover:bg-primary-50/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium text-neutral-900">
                      {record.title}
                    </p>
                    <p className="text-caption text-neutral-400">
                      {t("studyCount", { count: record.studyCount })} ·{" "}
                      {dateFmt.format(new Date(record.createdAt))}
                    </p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-small font-medium text-primary-700"
                  >
                    {t("open")} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

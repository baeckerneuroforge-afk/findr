import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { getMetaSynthesis } from "@/lib/meta-synthesis/service";
import { MetaSynthesisView } from "@/components/dashboard/MetaSynthesisView";

/**
 * /dashboard/insights/meta-synthesis/[id] — the persisted meta-synthesis artifact.
 * Server component: org-scoped read (getMetaSynthesis returns null cross-org, so
 * we never leak existence), then the read-only <MetaSynthesisView />.
 *
 * Auth mirrors the insights page: requireOrgId(), redirect on no_auth/no_org.
 */

export default async function MetaSynthesisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const { id } = await params;
  const record = await getMetaSynthesis(orgId, id);

  if (!record) {
    const t = await getTranslations("metaSynthesis");
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/insights/meta-synthesis"
          className="text-small font-medium text-primary-700 transition-colors hover:underline"
        >
          ← {t("backToList")}
        </Link>
        <p className="text-body text-neutral-500">{t("notFound")}</p>
      </div>
    );
  }

  return <MetaSynthesisView record={record} />;
}

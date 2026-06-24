import { getTranslations } from "next-intl/server";

/**
 * Read-only organization profile. With "one customer = one Zitadel org", the
 * org name + members are managed in the Zitadel console (decision Q2), so this
 * replaces the former Clerk `organization.update()` form: it shows the current
 * identity and links out to Zitadel. Org identity is passed in from the server
 * page (Zitadel session).
 */
export async function OrganizationSettingsForm({
  orgName,
  orgId,
  consoleUrl,
}: {
  orgName: string | null;
  orgId: string | null;
  consoleUrl: string;
}) {
  const t = await getTranslations("settings");

  return (
    <div className="rounded-lg border border-neutral-200 bg-card p-5">
      <div className="mb-5">
        <h2 className="text-h2 text-neutral-900">
          {t("orgForm.profileHeading")}
        </h2>
        <p className="mt-1 text-body text-neutral-500">
          {t("orgForm.profileSubtitle")}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-caption uppercase tracking-wider text-neutral-400">
            {t("orgForm.nameLabel")}
          </div>
          <div className="mt-1 text-body-strong text-neutral-900">
            {orgName ?? t("orgForm.noActiveOrg")}
          </div>
        </div>

        <div>
          <div className="text-caption uppercase tracking-wider text-neutral-400">
            {t("orgForm.orgIdLabel")}
          </div>
          <div className="mt-1 break-all text-neutral-700">{orgId ?? "—"}</div>
        </div>

        <a
          href={consoleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center justify-center rounded-md bg-primary-600 px-3 text-body-strong font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {t("orgForm.manageInZitadel")} →
        </a>
      </div>
    </div>
  );
}

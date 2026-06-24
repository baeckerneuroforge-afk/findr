"use client";

import { useTranslations } from "next-intl";

/**
 * Header org chip. The active organization name now comes from the server as a
 * prop (derived from the Zitadel session in (dashboard)/layout.tsx) instead of
 * Clerk's useOrganization() hook.
 */
export function OrgDisplay({ orgName }: { orgName: string | null }) {
  const t = useTranslations("common");

  if (!orgName) {
    return (
      <span className="text-body text-neutral-500">{t("noOrganization")}</span>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-100">
        <span className="text-caption font-semibold text-primary-700">
          {orgName.charAt(0).toUpperCase()}
        </span>
      </div>
      <span className="text-body-strong text-neutral-900">{orgName}</span>
    </div>
  );
}

"use client";

import { useOrganization } from "@clerk/nextjs";
import { useTranslations } from "next-intl";

export function OrgDisplay() {
  const { organization, isLoaded } = useOrganization();
  const t = useTranslations("common");

  if (!isLoaded) {
    return (
      <div
        aria-hidden="true"
        className="h-8 w-40 animate-pulse rounded-md bg-neutral-100"
      />
    );
  }

  if (!organization) {
    return (
      <span className="text-body text-neutral-500">{t("noOrganization")}</span>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-100">
        <span className="text-caption font-semibold text-primary-700">
          {organization.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <span className="text-body-strong text-neutral-900">
        {organization.name}
      </span>
    </div>
  );
}

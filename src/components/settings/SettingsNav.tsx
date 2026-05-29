"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const SETTINGS_NAV = [
  { href: "/dashboard/settings/profile", labelKey: "nav.profile" },
  { href: "/dashboard/settings/organization", labelKey: "nav.organization" },
  { href: "/dashboard/settings/team", labelKey: "nav.team" },
  { href: "/dashboard/settings/data", labelKey: "nav.data" },
  { href: "/dashboard/settings/billing", labelKey: "nav.billing" },
];

export function SettingsNav() {
  const pathname = usePathname();
  const t = useTranslations("settings");

  return (
    <nav
      aria-label={t("navAria")}
      className="flex gap-1 overflow-x-auto border-b border-neutral-200"
    >
      {SETTINGS_NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-body-strong transition-colors ${
              active
                ? "border-primary-500 text-primary-700"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

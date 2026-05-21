"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SETTINGS_NAV = [
  { href: "/dashboard/settings/profile", label: "Profile" },
  { href: "/dashboard/settings/organization", label: "Organization" },
  { href: "/dashboard/settings/team", label: "Team" },
  { href: "/dashboard/settings/data", label: "Data & Privacy" },
  { href: "/dashboard/settings/billing", label: "Billing" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings navigation"
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

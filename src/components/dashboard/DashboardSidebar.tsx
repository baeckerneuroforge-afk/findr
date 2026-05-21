"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Pipeline" },
  { href: "/dashboard/forecast", label: "Forecast" },
  { href: "/dashboard/coaching", label: "Team Coaching" },
  { href: "/dashboard/loss-analysis", label: "Loss Analysis" },
];

const INTEGRATIONS_NAV: NavItem[] = [
  { href: "/dashboard/integrations/hubspot", label: "Hubspot" },
  { href: "/dashboard/integrations/gong", label: "Gong" },
  { href: "/dashboard/integrations/slack", label: "Slack" },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`block px-3 py-1.5 rounded-md text-body transition-colors ${
                active
                  ? "bg-neutral-100 text-neutral-900 font-medium"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-white border-r border-neutral-200 flex flex-col">
      {/* Logo */}
      <div className="h-14 px-6 border-b border-neutral-200 flex items-center">
        <Link
          href="/dashboard"
          aria-label="Findr"
          className="relative inline-block"
        >
          <span className="text-neutral-900 font-semibold text-lg tracking-tight">
            findr
          </span>
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-1.5 w-1.5 h-1.5 bg-danger-500 rounded-full"
          />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        <NavList items={PRIMARY_NAV} pathname={pathname} />

        <div>
          <div className="px-3 mb-2 text-caption text-neutral-400 uppercase tracking-wider font-medium">
            Integrations
          </div>
          <NavList items={INTEGRATIONS_NAV} pathname={pathname} />
        </div>
      </nav>

      <div className="border-t border-neutral-200 px-3 py-4">
        <NavList
          items={[{ href: "/dashboard/settings", label: "Settings" }]}
          pathname={pathname}
        />
      </div>
    </aside>
  );
}

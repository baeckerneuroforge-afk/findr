"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Primary navigation, grouped by product module. The grouping is the
 * navigation's main job: tell users at a glance which feature belongs to
 * which Findr capability (Sales Intelligence vs Customer Health) and which
 * tools are workspace-level plumbing.
 *
 * Routes themselves are UNCHANGED from the previous flat version — only the
 * sidebar's grouping/labeling changed. Each NavItem.href is identical to
 * what it linked to before this restructure.
 */

interface NavItem {
  href: string;
  label: string;
}

interface NavGroupDef {
  /** Small-caps section header rendered above the items. Kept dezent
   *  on purpose — it structures, it doesn't shout. */
  label: string;
  items: NavItem[];
}

/** Product modules — the two domains the platform is built around. */
const MODULES: NavGroupDef[] = [
  {
    label: "Sales Intelligence",
    items: [
      { href: "/dashboard", label: "Pipeline" },
      { href: "/dashboard/forecast", label: "Forecast" },
      { href: "/dashboard/loss-analysis", label: "Loss Analysis" },
      { href: "/dashboard/coaching", label: "Team Coaching" },
    ],
  },
  {
    label: "Customer Health",
    items: [
      { href: "/dashboard/accounts", label: "Accounts" },
      { href: "/dashboard/health", label: "Health Overview" },
    ],
  },
  // Product module — what we learn ABOUT the product, from two angles:
  //   Product Discovery — retrospective extraction from existing calls
  //                       (Sales + CS) via the per-call classifier.
  //   Research Plans    — proactive: plan-driven research interviews, run
  //                       by the AI agent against invited participants.
  // Both surfaces feed the same product_discovery_insights table; the
  // grouping reflects that they're two ways into the same learning loop.
  {
    label: "Product",
    items: [
      { href: "/dashboard/product-discovery", label: "Product Discovery" },
      { href: "/dashboard/research-plans", label: "Research Plans" },
      { href: "/dashboard/research-plans/pool", label: "Teilnehmer-Pool" },
    ],
  },
];

/** Cross-cutting workspace tools — not a product module, but the plumbing
 *  + account-level controls. Rendered in a footer block separated by a
 *  divider so it reads as "different kind of thing". */
const WORKSPACE: NavGroupDef = {
  label: "Workspace",
  items: [
    { href: "/dashboard/data-sources", label: "Data Sources" },
    { href: "/dashboard/settings", label: "Settings" },
  ],
};

function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/research-plans") {
    // Der Teilnehmer-Pool hat einen eigenen Eintrag (/research-plans/pool) —
    // hier NICHT mit-aktivieren, sonst leuchten beide. Plan-Detailseiten
    // (/research-plans/[id]) bleiben dagegen unter "Research Plans".
    return (
      (pathname === href || pathname.startsWith(`${href}/`)) &&
      pathname !== "/dashboard/research-plans/pool" &&
      !pathname.startsWith("/dashboard/research-plans/pool/")
    );
  }
  if (href === "/dashboard/data-sources") {
    // Data Sources is the umbrella for /dashboard/integrations/*
    // (Gong / Hubspot / Slack). Treat the sidebar entry as active for
    // either prefix so users don't lose orientation while configuring
    // a specific integration. Unchanged behavior from the flat sidebar.
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      pathname.startsWith("/dashboard/integrations/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavSection({
  group,
  pathname,
}: {
  group: NavGroupDef;
  pathname: string;
}) {
  return (
    <div>
      <div className="mb-1.5 px-3 text-caption font-medium uppercase tracking-wider text-neutral-400">
        {group.label}
      </div>
      <ul className="space-y-0.5">
        {group.items.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-md px-3 py-1.5 text-body transition-colors ${
                  active
                    ? "bg-neutral-100 text-neutral-900 font-medium"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-neutral-200 bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-neutral-200 px-6">
        <Link
          href="/dashboard"
          aria-label="Findr"
          className="relative inline-block"
        >
          <span className="text-lg font-semibold tracking-tight text-neutral-900">
            findr
          </span>
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-1.5 h-1.5 w-1.5 rounded-full bg-danger-500"
          />
        </Link>
      </div>

      {/* Primary nav — grouped by product module */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {MODULES.map((group) => (
          <NavSection key={group.label} group={group} pathname={pathname} />
        ))}
      </nav>

      {/* Workspace — cross-cutting tools, divided from the modules above */}
      <div className="border-t border-neutral-200 px-3 py-4">
        <NavSection group={WORKSPACE} pathname={pathname} />
      </div>
    </aside>
  );
}

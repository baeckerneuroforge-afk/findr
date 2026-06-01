"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Primary navigation, grouped by product module. The grouping is the
 * navigation's main job: tell users at a glance which feature belongs to
 * which Findr capability (Sales Intelligence / Customer / Research) and which
 * tools are workspace-level plumbing.
 *
 * Routes themselves are UNCHANGED from the previous flat version — only the
 * sidebar's grouping/labeling changed. Each NavItem.href is identical to
 * what it linked to before this restructure.
 *
 * Labels live in the nav.* message catalog (i18n Etappe 2); each entry carries
 * a labelKey resolved at render via useTranslations("nav"). The Cmd+K palette
 * mirrors this route list in src/lib/search/nav-routes.ts with the same keys.
 */

interface NavItem {
  href: string;
  labelKey: string;
}

interface NavGroupDef {
  /** nav.* catalog key for the small-caps section header. Kept dezent on
   *  purpose — it structures, it doesn't shout. */
  labelKey: string;
  items: NavItem[];
}

/** Product modules — the two domains the platform is built around. */
const MODULES: NavGroupDef[] = [
  {
    labelKey: "group.salesIntelligence",
    items: [
      { href: "/dashboard", labelKey: "item.pipeline" },
      { href: "/dashboard/forecast", labelKey: "item.forecast" },
      { href: "/dashboard/loss-analysis", labelKey: "item.lossAnalysis" },
      { href: "/dashboard/coaching", labelKey: "item.coaching" },
    ],
  },
  {
    labelKey: "group.customer",
    items: [
      { href: "/dashboard/accounts", labelKey: "item.accounts" },
      { href: "/dashboard/health", labelKey: "item.health" },
    ],
  },
  // Research module — what we learn ABOUT the product, from two angles:
  //   Product Discovery — retrospective extraction from existing calls
  //                       (Sales + CS) via the per-call classifier.
  //   Research Plans    — proactive: plan-driven research interviews, run
  //                       by the AI agent against invited participants.
  // Both surfaces feed the same product_discovery_insights table; the
  // grouping reflects that they're two ways into the same learning loop.
  {
    labelKey: "group.research",
    items: [
      {
        href: "/dashboard/product-discovery",
        labelKey: "item.productDiscovery",
      },
      { href: "/dashboard/research-plans", labelKey: "item.researchPlans" },
      {
        href: "/dashboard/research-plans/pool",
        labelKey: "item.participantPool",
      },
      // Cross-Study (Mission-Control) — org-level chat ACROSS all study
      // syntheses. Lives next to Research Plans because it reads from the same
      // studies, but it is NOT inside any single study (its own top-level page).
      { href: "/dashboard/insights", labelKey: "item.crossStudy" },
    ],
  },
];

/** Cross-cutting workspace tools — not a product module, but the plumbing
 *  + account-level controls. Rendered in a footer block separated by a
 *  divider so it reads as "different kind of thing". */
const WORKSPACE: NavGroupDef = {
  labelKey: "group.workspace",
  items: [
    { href: "/dashboard/data-sources", labelKey: "item.dataSources" },
    { href: "/dashboard/settings", labelKey: "item.settings" },
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
  const t = useTranslations("nav");
  return (
    <div>
      <div className="mb-1.5 px-3 text-caption font-medium uppercase tracking-wider text-neutral-400">
        {t(group.labelKey)}
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
                    ? "bg-primary-50 text-primary-700 font-medium"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
              >
                {t(item.labelKey)}
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
          <NavSection key={group.labelKey} group={group} pathname={pathname} />
        ))}
      </nav>

      {/* Workspace — cross-cutting tools, divided from the modules above */}
      <div className="border-t border-neutral-200 px-3 py-4">
        <NavSection group={WORKSPACE} pathname={pathname} />
      </div>
    </aside>
  );
}

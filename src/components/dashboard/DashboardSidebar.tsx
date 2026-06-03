"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";

/**
 * Primary navigation, grouped by product module. The grouping is the
 * navigation's main job: tell users at a glance which feature belongs to
 * which Findr capability (Sales Intelligence / Customer / Product Discovery /
 * Market Research / cross-study analysis) and which tools are workspace-level
 * plumbing.
 *
 * Routes themselves are UNCHANGED from the previous flat/3-group version —
 * only the sidebar's grouping/labeling changed. Each NavItem.href is identical
 * to what it linked to before this restructure (no file moves, no redirects).
 *
 * Labels live in the nav.* message catalog (i18n Etappe 2); each entry carries
 * a labelKey resolved at render via useTranslations("nav"). The Cmd+K palette
 * mirrors this route list in src/lib/search/nav-routes.ts with the same keys.
 *
 * Each module group is a collapsible accordion section (disclosure pattern,
 * modelled on the marketing MobileNav): a `<button aria-expanded aria-controls>`
 * caption toggles its `<ul>`. Multiple groups may be open at once; open state
 * is per-mount session state only (no localStorage in v1). The group holding
 * the active route seeds open and is re-revealed on navigation, but a group the
 * user opened is never auto-collapsed.
 */

interface NavItem {
  href: string;
  labelKey: string;
}

interface NavGroupDef {
  /** nav.* catalog key for the small-caps section header. Kept dezent on
   *  purpose — it structures, it doesn't shout. Also doubles as the accordion
   *  section's identity (open-set key + aria-controls panel id). */
  labelKey: string;
  items: NavItem[];
}

/** Product modules — the domains the platform is built around. Research is
 *  split along its real axes so each lens gets its own section:
 *    Product Discovery — retrospective extraction "Aus Gesprächen"
 *                        (/product-discovery) + plan-driven product-discovery
 *                        research (/research-plans, study_type='product_discovery').
 *    Market Research   — proactive market campaigns (/market-research,
 *                        study_type='market_research') on the SAME engine; only
 *                        the discriminator + campaign bundling differ.
 *    Cross-study       — surfaces that span ALL studies: the shared participant
 *                        pool (/research-plans/pool) and the org-level
 *                        cross-study chat (/insights, Mission-Control).
 *  All surfaces feed the same product_discovery_insights / study_synthesis
 *  tables; the grouping reflects ways into the same learning loop, separated by
 *  lens (product vs. market vs. cross-study), not by data store. */
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
  {
    labelKey: "group.productDiscovery",
    items: [
      { href: "/dashboard/product-discovery", labelKey: "item.productDiscovery" },
      { href: "/dashboard/research-plans", labelKey: "item.researchPlans" },
    ],
  },
  {
    labelKey: "group.marketResearch",
    items: [
      { href: "/dashboard/market-research", labelKey: "item.marketResearch" },
    ],
  },
  {
    labelKey: "group.crossStudy",
    items: [
      { href: "/dashboard/research-plans/pool", labelKey: "item.participantPool" },
      // Cross-Study (Mission-Control) — org-level chat ACROSS all study
      // syntheses. Lives here because it reads from every study, but it is NOT
      // inside any single study (its own top-level page).
      { href: "/dashboard/insights", labelKey: "item.crossStudy" },
    ],
  },
];

/** Cross-cutting workspace tools — not a product module, but the plumbing
 *  + account-level controls. Rendered in a footer block separated by a
 *  divider so it reads as "different kind of thing". Stays a flat,
 *  always-expanded block (NOT an accordion): settings + data sources must
 *  always be one click away, never hidden behind a collapse. */
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

/** Module group keys whose section currently contains the active route. Used
 *  to seed/extend the open accordion set so you never land on a page whose nav
 *  entry is hidden inside a collapsed group. */
function activeGroupKeys(pathname: string): string[] {
  return MODULES.filter((group) =>
    group.items.some((item) => isActive(item.href, pathname)),
  ).map((group) => group.labelKey);
}

/** Stable, valid DOM id for a group's disclosure panel (aria-controls target).
 *  "group.salesIntelligence" → "nav-group-salesIntelligence". */
function panelId(labelKey: string): string {
  return `nav-group-${labelKey.split(".").pop() ?? labelKey}`;
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** The list of links for a group. Single source for the active-link markup so
 *  the accordion sections and the flat workspace block can never visually
 *  drift. `id`/`className` let the accordion attach its aria-controls panel id
 *  and the fade-in animation; the flat workspace block passes neither. */
function NavLinkList({
  items,
  pathname,
  id,
  className,
}: {
  items: NavItem[];
  pathname: string;
  id?: string;
  className?: string;
}) {
  const t = useTranslations("nav");
  return (
    <ul id={id} className={`space-y-0.5${className ? ` ${className}` : ""}`}>
      {items.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
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
  );
}

/** A collapsible module group: caption-button toggles its link list. */
function NavSection({
  group,
  pathname,
  expanded,
  onToggle,
  animate,
}: {
  group: NavGroupDef;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  animate: boolean;
}) {
  const t = useTranslations("nav");
  const id = panelId(group.labelKey);
  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={onToggle}
        className="mb-1.5 flex w-full items-center justify-between rounded px-3 text-caption font-medium uppercase tracking-wider text-neutral-400 transition-colors hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
      >
        <span>{t(group.labelKey)}</span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 transition-transform duration-150 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      {expanded ? (
        <NavLinkList
          items={group.items}
          pathname={pathname}
          id={id}
          className={animate ? "animate-fade-in-panel" : undefined}
        />
      ) : null}
    </div>
  );
}

export default function DashboardSidebar() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const t = useTranslations("nav");

  // Open accordion sections, keyed by group.labelKey. Seeded with the group
  // that holds the active route so a deep-link never lands inside a collapsed
  // group. Per-mount session state only — no localStorage in v1.
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(activeGroupKeys(pathname)),
  );

  // Groups whose fade-in should play — ONLY those the user toggled open via the
  // caption button. The seeded-open active group and navigation-opened groups
  // are deliberately absent, so (a) the `animate-fade-in-panel` class is never
  // in the server-rendered HTML → no hydration mismatch and no re-fade on every
  // hard page load (the active group is open at SSR), and (b) the fade is
  // reserved for a deliberate disclosure gesture. Per-mount only (no localStorage).
  const [animatedKeys, setAnimatedKeys] = useState<Set<string>>(() => new Set());

  // On navigation, ADD the active group to the open set — never remove. We
  // never collapse a group the user opened, and never close the others; the
  // adjustment is purely additive. This is the React "adjust state while
  // rendering when a value changes" pattern (https://react.dev/learn/
  // you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes) —
  // it runs synchronously before paint (no flash, no effect) and the setState
  // bails out via the unchanged Set when the active group is already open, so
  // the comparison re-render terminates immediately.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    const active = activeGroupKeys(pathname);
    if (active.length > 0) {
      setOpenGroups((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const key of active) {
          if (!next.has(key)) {
            next.add(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }

  const toggleGroup = (key: string) => {
    const opening = !openGroups.has(key);
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (opening) next.add(key);
      else next.delete(key);
      return next;
    });
    // Mark on open (so the fade plays), clear on close (so a later re-open
    // animates again). Seeding and the pathname effect never touch this set.
    setAnimatedKeys((prev) => {
      const next = new Set(prev);
      if (opening) next.add(key);
      else next.delete(key);
      return next;
    });
  };

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

      {/* Primary nav — grouped by product module, each group collapsible */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {MODULES.map((group) => (
          <NavSection
            key={group.labelKey}
            group={group}
            pathname={pathname}
            expanded={openGroups.has(group.labelKey)}
            onToggle={() => toggleGroup(group.labelKey)}
            animate={animatedKeys.has(group.labelKey) && !reduceMotion}
          />
        ))}
      </nav>

      {/* Workspace — cross-cutting tools, divided from the modules above. Flat
          and always expanded (not an accordion): plumbing stays one click away. */}
      <div className="border-t border-neutral-200 px-3 py-4">
        <div className="mb-1.5 px-3 text-caption font-medium uppercase tracking-wider text-neutral-400">
          {t(WORKSPACE.labelKey)}
        </div>
        <NavLinkList items={WORKSPACE.items} pathname={pathname} />
      </div>
    </aside>
  );
}

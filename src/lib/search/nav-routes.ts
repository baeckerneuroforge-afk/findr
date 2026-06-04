/**
 * Flat list of navigation targets the Cmd+K palette can jump to. Parallel
 * to the grouped structure in `src/components/dashboard/DashboardSidebar.tsx`
 * — kept here as a separate source of truth so this module can be imported
 * cleanly into a client component without dragging the sidebar's full
 * "use client" + group rendering with it.
 *
 * If a new dashboard route is added to the sidebar, mirror it here so the
 * palette finds it. The two files drifting is a real (small) maintenance
 * cost; the alternative was extracting the routes out of the sidebar into
 * shared config, which inflated the diff against existing sidebar wiring
 * with no end-user visible benefit.
 *
 * i18n (Etappe 2): labels/groups are nav.* catalog KEYS, not literal text —
 * the palette resolves them at render via useTranslations(). The keys match
 * the sidebar's, so both surfaces share one translated label source.
 */

import {
  ENABLED_MODULES,
  type DashboardModuleKey,
} from "@/config/modules";

export interface PaletteRoute {
  /** nav.item.* catalog key for the route label. */
  labelKey: string;
  href: string;
  /** nav.group.* catalog key for the sidebar group the route belongs to —
   *  surfaced as a small contextual label in the palette row so users see
   *  "Forecast (Sales Intelligence)" rather than just "Forecast" floating
   *  without context. */
  groupKey: string;
}

interface PaletteRouteDef extends PaletteRoute {
  module?: DashboardModuleKey;
}

const ALL_PALETTE_ROUTES: PaletteRouteDef[] = [
  // Sales Intelligence
  { module: "salesIntelligence", labelKey: "nav.item.pipeline", href: "/dashboard", groupKey: "nav.group.salesIntelligence" },
  { module: "salesIntelligence", labelKey: "nav.item.forecast", href: "/dashboard/forecast", groupKey: "nav.group.salesIntelligence" },
  { module: "salesIntelligence", labelKey: "nav.item.lossAnalysis", href: "/dashboard/loss-analysis", groupKey: "nav.group.salesIntelligence" },
  { module: "salesIntelligence", labelKey: "nav.item.coaching", href: "/dashboard/coaching", groupKey: "nav.group.salesIntelligence" },

  // Customer
  { module: "csHealth", labelKey: "nav.item.accounts", href: "/dashboard/accounts", groupKey: "nav.group.customer" },
  { module: "csHealth", labelKey: "nav.item.health", href: "/dashboard/health", groupKey: "nav.group.customer" },

  // Product Discovery — retrospective + plan-driven product-discovery research
  { module: "productDiscovery", labelKey: "nav.item.productDiscovery", href: "/dashboard/product-discovery", groupKey: "nav.group.productDiscovery" },
  { module: "productDiscovery", labelKey: "nav.item.researchPlans", href: "/dashboard/research-plans", groupKey: "nav.group.productDiscovery" },

  // Market Research
  { module: "marketResearch", labelKey: "nav.item.marketResearch", href: "/dashboard/market-research", groupKey: "nav.group.marketResearch" },

  // Cross-study (studienübergreifend)
  { module: "insights", labelKey: "nav.item.crossStudy", href: "/dashboard/insights", groupKey: "nav.group.crossStudy" },

  // Workspace
  { labelKey: "nav.item.dataSources", href: "/dashboard/data-sources", groupKey: "nav.group.workspace" },
  { labelKey: "nav.item.settings", href: "/dashboard/settings", groupKey: "nav.group.workspace" },
];

export const PALETTE_ROUTES: PaletteRoute[] = ALL_PALETTE_ROUTES.filter(
  (route) => route.module === undefined || ENABLED_MODULES[route.module],
).map(({ module: _module, ...route }) => route);

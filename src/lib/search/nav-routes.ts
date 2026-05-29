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

export const PALETTE_ROUTES: PaletteRoute[] = [
  // Sales Intelligence
  { labelKey: "nav.item.pipeline", href: "/dashboard", groupKey: "nav.group.salesIntelligence" },
  { labelKey: "nav.item.forecast", href: "/dashboard/forecast", groupKey: "nav.group.salesIntelligence" },
  { labelKey: "nav.item.lossAnalysis", href: "/dashboard/loss-analysis", groupKey: "nav.group.salesIntelligence" },
  { labelKey: "nav.item.coaching", href: "/dashboard/coaching", groupKey: "nav.group.salesIntelligence" },

  // Customer Health
  { labelKey: "nav.item.accounts", href: "/dashboard/accounts", groupKey: "nav.group.customerHealth" },
  { labelKey: "nav.item.health", href: "/dashboard/health", groupKey: "nav.group.customerHealth" },

  // Product
  { labelKey: "nav.item.productDiscovery", href: "/dashboard/product-discovery", groupKey: "nav.group.product" },

  // Workspace
  { labelKey: "nav.item.dataSources", href: "/dashboard/data-sources", groupKey: "nav.group.workspace" },
  { labelKey: "nav.item.settings", href: "/dashboard/settings", groupKey: "nav.group.workspace" },
];

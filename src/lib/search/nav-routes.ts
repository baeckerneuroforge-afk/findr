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
 */

export interface PaletteRoute {
  label: string;
  href: string;
  /** Sidebar group the route belongs to — surfaced as a small contextual
   *  label in the palette row so users see "Forecast (Sales Intelligence)"
   *  rather than just "Forecast" floating without context. */
  group: string;
}

export const PALETTE_ROUTES: PaletteRoute[] = [
  // Sales Intelligence
  { label: "Pipeline", href: "/dashboard", group: "Sales Intelligence" },
  { label: "Forecast", href: "/dashboard/forecast", group: "Sales Intelligence" },
  { label: "Loss Analysis", href: "/dashboard/loss-analysis", group: "Sales Intelligence" },
  { label: "Team Coaching", href: "/dashboard/coaching", group: "Sales Intelligence" },

  // Customer Health
  { label: "Accounts", href: "/dashboard/accounts", group: "Customer Health" },
  { label: "Health Overview", href: "/dashboard/health", group: "Customer Health" },

  // Product
  { label: "Product Discovery", href: "/dashboard/product-discovery", group: "Product" },

  // Workspace
  { label: "Data Sources", href: "/dashboard/data-sources", group: "Workspace" },
  { label: "Settings", href: "/dashboard/settings", group: "Workspace" },
];

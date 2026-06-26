"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ENABLED_MODULES,
  type DashboardModuleKey,
} from "@/config/modules";
import { KlymeoMark } from "@/components/shared/KlymeoMark";

/**
 * Primary navigation, grouped by product module. The grouping is the
 * navigation's main job: tell users at a glance which feature belongs to
 * which Klymeo capability (Sales Intelligence / Customer / Product Discovery /
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

/** Line-icon set for the nav (E3). Each entry is the SVG `<path>` content of a
 *  single, simple stroke glyph drawn on a 24×24 grid; the wrapping <svg>
 *  (currentColor, strokeWidth 1.75, ~18px, aria-hidden) is shared in NavIcon so
 *  every icon is visually consistent and inherits the link's text colour — no
 *  fill, no second colour. `house` is "Heute"; the rest follow the spec
 *  (Studien=Kolben, Pool=Personen, Aus Gesprächen=Sprechblase, Research-Pläne=
 *  Liste, Pipeline=Spalten, Forecast/Verlust=Trend ↑/↓, Team=Personen,
 *  Accounts=Gebäude, Gesundheit=Puls, Cross-Study=Graph, Datenquellen=Datenbank,
 *  Einstellungen=Zahnrad). */
const ICONS = {
  house: <path d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V9.5" />,
  beaker: <path d="M9 3h6M10 3v6.5L5.5 18a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 9.5V3M7.5 14h9" />,
  people: (
    <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20v-1a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5v1M16.5 4.3a3.5 3.5 0 0 1 0 6.4M18 14.6a4.5 4.5 0 0 1 3.5 4.4v1" />
  ),
  chat: <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />,
  clipboard: (
    <path d="M9 4h6M9 4a1 1 0 0 0-1 1v1h8V5a1 1 0 0 0-1-1M8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M8.5 11h7M8.5 15h5" />
  ),
  columns: <path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM9.5 4v16M15 4v16" />,
  trendingUp: <path d="m3 16 5.5-5.5 3.5 3.5L21 6M16 6h5v5" />,
  trendingDown: <path d="m3 8 5.5 5.5 3.5-3.5L21 18M16 18h5v-5" />,
  users: (
    <path d="M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2 20v-1a4.5 4.5 0 0 1 4.5-4.5h3A4.5 4.5 0 0 1 14 19v1M15.5 4.3a3.5 3.5 0 0 1 0 6.4M17 14.6a4.5 4.5 0 0 1 3 4.4v1" />
  ),
  building: (
    <path d="M5 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16M14 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h2M8 12h2M8 16h2M17 13h-1M17 17h-1" />
  ),
  activity: <path d="M3 12h3.5L9 5l4 14 2.5-7H21" />,
  calendar: (
    <path d="M8 3v3m8-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
  ),
  gitBranch: (
    <path d="M6 4v12M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 7a6 6 0 0 1-6 6h-2a4 4 0 0 0-4 4" />
  ),
  database: (
    <path d="M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3ZM4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" />
  ),
  gear: (
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  ),
} as const;

type IconKey = keyof typeof ICONS;

/** Renders one nav line-icon. Shared <svg> chrome (currentColor stroke 1.75,
 *  ~18px, aria-hidden) so the glyph inherits the link's text colour and never
 *  introduces its own — the only icon styling is the colour the parent passes
 *  down via `currentColor`. `shrink-0` keeps it from squashing when the label
 *  wraps; it stays centered in the collapsed icon rail. */
function NavIcon({ name }: { name: IconKey }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-[18px] w-[18px] shrink-0"
    >
      {ICONS[name]}
    </svg>
  );
}

interface NavItem {
  href: string;
  labelKey: string;
  /** Line-icon key (see ICONS). One simple stroke glyph per entry, rendered
   *  before the label so it inherits the link's text colour (muted default,
   *  ink on hover/active — no extra colour of its own). E3. */
  icon: IconKey;
}

interface NavGroupDef {
  /** nav.* catalog key for the section header. Rendered prominent (text-h3,
   *  near-black, normal case — not the old dezent uppercase caption) so each
   *  group reads as a clear heading above its items. Also doubles as the
   *  accordion section's identity (open-set key + aria-controls panel id). */
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
 *    Cross-study       — org-level cross-study chat (/insights,
 *                        Mission-Control).
 *  All surfaces feed the same product_discovery_insights / study_synthesis
 *  tables; the grouping reflects ways into the same learning loop, separated by
 *  lens (product vs. market vs. cross-study), not by data store. */
const MODULES: Array<NavGroupDef & { module: DashboardModuleKey }> = [
  {
    labelKey: "group.salesIntelligence",
    module: "salesIntelligence",
    items: [
      { href: "/dashboard", labelKey: "item.pipeline", icon: "columns" },
      { href: "/dashboard/forecast", labelKey: "item.forecast", icon: "trendingUp" },
      { href: "/dashboard/loss-analysis", labelKey: "item.lossAnalysis", icon: "trendingDown" },
      { href: "/dashboard/coaching", labelKey: "item.coaching", icon: "users" },
    ],
  },
  {
    labelKey: "group.customer",
    module: "csHealth",
    items: [
      { href: "/dashboard/accounts", labelKey: "item.accounts", icon: "building" },
      { href: "/dashboard/health", labelKey: "item.health", icon: "activity" },
    ],
  },
  {
    labelKey: "group.productDiscovery",
    module: "productDiscovery",
    items: [
      { href: "/dashboard/product-discovery", labelKey: "item.productDiscovery", icon: "chat" },
      { href: "/dashboard/research-plans", labelKey: "item.researchPlans", icon: "clipboard" },
    ],
  },
  {
    labelKey: "group.marketResearch",
    module: "marketResearch",
    items: [
      { href: "/dashboard/market-research", labelKey: "item.marketResearch", icon: "beaker" },
      // Studien-Zeitplaner — Kalender-Agenda über geplante Aktivierungen
      // (Deferred Activation). Eigene Top-Level-Route, market_research-scoped.
      { href: "/dashboard/kalender", labelKey: "item.kalender", icon: "calendar" },
      // Org-weiter Teilnehmer-Pool — Route bleibt /research-plans/pool;
      // isActive() trennt ihn bereits vom researchPlans-Eintrag (PD-Gruppe).
      { href: "/dashboard/research-plans/pool", labelKey: "item.participantPool", icon: "people" },
    ],
  },
  {
    labelKey: "group.crossStudy",
    module: "insights",
    items: [
      // Cross-Study (Mission-Control) — org-level chat ACROSS all study
      // syntheses. Lives here because it reads from every study, but it is NOT
      // inside any single study (its own top-level page).
      { href: "/dashboard/insights", labelKey: "item.crossStudy", icon: "gitBranch" },
    ],
  },
];

const VISIBLE_MODULES = MODULES.filter(
  (group) => ENABLED_MODULES[group.module],
);

/** Cross-cutting workspace tools — not a product module, but the plumbing
 *  + account-level controls. Rendered in a footer block separated by a
 *  divider so it reads as "different kind of thing". Stays a flat,
 *  always-expanded block (NOT an accordion): settings + data sources must
 *  always be one click away, never hidden behind a collapse. */
const WORKSPACE: NavGroupDef = {
  labelKey: "group.workspace",
  items: [
    { href: "/dashboard/data-sources", labelKey: "item.dataSources", icon: "database" },
    { href: "/dashboard/settings", labelKey: "item.settings", icon: "gear" },
  ],
};

/** Accessible labels for the E3 collapse toggle. Kept as a local literal (not a
 *  nav.* catalog key) so this etappe touches no message file; matches the
 *  German-primary chrome of the sidebar. Swap to `t("nav.collapse.*")` once the
 *  catalog gains the keys. */
const COLLAPSE_LABEL = {
  collapse: "Navigation einklappen",
  expand: "Navigation ausklappen",
} as const;

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
  return VISIBLE_MODULES.filter((group) =>
    group.items.some((item) => isActive(item.href, pathname)),
  ).map((group) => group.labelKey);
}

/** Stable, valid DOM id for a group's disclosure panel (aria-controls target).
 *  "group.salesIntelligence" → "nav-group-salesIntelligence". */
function panelId(labelKey: string): string {
  return `nav-group-${labelKey.split(".").pop() ?? labelKey}`;
}

/** Live prefers-reduced-motion subscription. SSR-safe (server snapshot =
 *  false). Gleiche private Hook-Form wie in InterviewChat — bewusst lokal
 *  statt Import aus dem Marketing-Baum (andere Domäne). */
function subscribeReducedMotion(callback: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
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

/** A single nav link with hover/focus-intent prefetching.
 *
 *  Default `prefetch={null}` keeps Next 16's cheap behavior: on viewport these
 *  dynamic dashboard routes prefetch only the shell down to the section's
 *  loading.tsx (the instant skeleton). On hover OR keyboard focus — a real
 *  navigation intent — it upgrades to `prefetch={true}`, which warms the FULL
 *  route INCLUDING its server data, so the click lands on finished content
 *  rather than a skeleton that then streams. The upgrade is bounded to the one
 *  link the user is actually targeting, so there is NO viewport-wide
 *  full-render storm (which forcing prefetch on every item would cause).
 *
 *  `intent` starts false, so SSR and first client render match exactly — and
 *  `prefetch` is a behavior prop, not a DOM attribute, so the rendered markup
 *  is byte-identical to the previous plain <Link>; no hydration change. The
 *  state lives per-link, so warming one item never re-renders the list or
 *  disturbs the sliding active-pill measurement in the parent. */
function NavItemLink({
  href,
  active,
  pillCarriesBg,
  icon,
  collapsed,
  children,
}: {
  href: string;
  active: boolean;
  pillCarriesBg: boolean;
  icon: IconKey;
  /** Icon-rail mode: drop the label to `sr-only` (kept for a11y), center the
   *  icon and surface the label as a hover/focus `title` tooltip PLUS an
   *  on-focus floating chip for keyboard users (see below). The active-pill
   *  measurement still finds this link via `data-nav-active`. E3. */
  collapsed: boolean;
  children: ReactNode;
}) {
  const [intent, setIntent] = useState(false);
  const warm = () => setIntent(true);
  return (
    <Link
      href={href}
      prefetch={intent ? true : null}
      onMouseEnter={warm}
      onFocus={warm}
      aria-current={active ? "page" : undefined}
      data-nav-active={active ? "true" : undefined}
      title={collapsed && typeof children === "string" ? children : undefined}
      className={`group/navlink relative flex items-center rounded-lg py-1.5 text-body transition-colors ${
        collapsed ? "justify-center px-2" : "gap-2.5 px-3"
      } ${
        active
          ? `text-primary-700 font-medium${
              pillCarriesBg ? "" : " bg-primary-50"
            }`
          : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
      }`}
    >
      <NavIcon name={icon} />
      <span className={collapsed ? "sr-only" : ""}>{children}</span>
      {/* Icon-Rail: das native `title` zeigt das Label NUR bei Maus-Hover —
          ein nur-Tastatur-Nutzer, der durch den Rail tabbt, sähe sonst gar
          kein Label. Dieser Chip erscheint zusätzlich bei :focus-visible am
          Link selbst (group-focus-visible/navlink) als Flyout rechts neben dem
          Rail.

          Warum `fixed` und nicht `absolute`: das scrollende <nav> ist
          overflow-y-auto, was per CSS-Spec overflow-x auf `auto` zwingt → ein
          `absolute left-full`-Chip würde an der Rail-Kante (64 px) abgeschnitten.
          Ein `fixed` Element ignoriert das Vorfahren-Overflow. left-16 = 64 px =
          die feste rechte Kante des `fixed w-16`-Rails (viewport-verankert),
          also sitzt der Chip exakt daneben. `top` bleibt auto → die statische
          Flow-Position richtet ihn vertikal von selbst am Link aus (kein JS,
          keine Mess-Logik). `pointer-events-none` + nicht-im-Flow → kein
          Layout-Shift des Rails, kein Klick-Fang. Nur eingeklappt gerendert
          (ausgeklappt steht das Label im Klartext). aria-hidden, weil das echte
          Label bereits als sr-only-Span + aria-current vorliegt — der Chip ist
          rein visuelle Tastatur-Hilfe. */}
      {collapsed && typeof children === "string" && (
        <span
          aria-hidden="true"
          className="pointer-events-none fixed left-16 z-30 ml-2 hidden whitespace-nowrap rounded-md border border-neutral-200 bg-card px-2.5 py-1 text-body text-neutral-900 shadow-lg group-focus-visible/navlink:block"
        >
          {children}
        </span>
      )}
    </Link>
  );
}

/** The list of links for a group. Single source for the active-link markup so
 *  the accordion sections and the flat workspace block can never visually
 *  drift. `id` lets the accordion attach its aria-controls panel id; the flat
 *  workspace block omits it. Item pills are `rounded-lg` for a softer edge —
 *  the active treatment (bg-primary-50 / text-primary-700 / font-medium) is
 *  unchanged from before this polish pass.
 *
 *  `pillCarriesBg` (Konsole-v5, V5-5): true, sobald die gleitende Sidebar-
 *  Pille armiert ist — dann trägt SIE die primary-50-Fläche und der aktive
 *  Link behält nur Textfarbe/Gewicht (sonst läge dieselbe Farbe doppelt da
 *  und der Glide bliebe unsichtbar). SSR / vor Mount / Reduced-Motion /
 *  Workspace-Footer: Prop bleibt false → exakt heutige Optik als Fallback.
 *  `data-nav-active` markiert den aktiven Link als Mess-Ziel der Pille. */
function NavLinkList({
  items,
  pathname,
  id,
  pillCarriesBg = false,
  collapsed = false,
}: {
  items: NavItem[];
  pathname: string;
  id?: string;
  pillCarriesBg?: boolean;
  collapsed?: boolean;
}) {
  const t = useTranslations("nav");
  return (
    <ul id={id} className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <li key={item.href}>
            <NavItemLink
              href={item.href}
              active={active}
              pillCarriesBg={pillCarriesBg}
              icon={item.icon}
              collapsed={collapsed}
            >
              {t(item.labelKey)}
            </NavItemLink>
          </li>
        );
      })}
    </ul>
  );
}

/** A collapsible module group: caption-button toggles its link list.
 *
 *  The disclosure panel animates its height open/closed via a CSS grid-rows
 *  1fr⇄0fr transition (the inner row clipped with `overflow-hidden`) — this
 *  gives an exact content-height slide with no max-height guesswork. The panel
 *  is ALWAYS rendered (never conditionally unmounted) so the height has both
 *  ends to animate between; when collapsed it is `inert`, which drops the links
 *  from tab order and the accessibility tree, preserving the disclosure
 *  contract even though the markup stays in the DOM.
 *
 *  Reduced motion is handled entirely in CSS via Tailwind's `motion-reduce:`
 *  variant (a compiled `@media (prefers-reduced-motion: reduce)` rule), NOT a
 *  JS value. That is deliberate: every class here depends only on `expanded`
 *  (derived from the pathname-seeded open set, identical on server and client),
 *  so the server HTML and the client's first render are byte-identical — no
 *  hydration mismatch — and because CSS transitions never fire on the initial
 *  paint, a group that is open at SSR appears at full height with no entrance
 *  animation. Open/close only animates on a subsequent state change (user
 *  toggle or a navigation that reveals the active group). */
function NavSection({
  group,
  pathname,
  expanded,
  onToggle,
  pillCarriesBg,
  collapsed,
}: {
  group: NavGroupDef;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  pillCarriesBg: boolean;
  collapsed: boolean;
}) {
  const t = useTranslations("nav");
  const id = panelId(group.labelKey);
  // Icon-rail mode: there is no room (and no point) for a caption + accordion,
  // so the group's items render as a flat, always-visible icon list (their
  // labels live in the per-item tooltips). Crucially they are NOT clipped and
  // NOT `inert` here — otherwise the active link would be hidden from the
  // sliding pill's `data-nav-active` lookup (which rejects targets inside
  // `[inert]`). The accordion open/closed state is left completely untouched in
  // the background, so it is exactly restored the moment the rail expands. E3.
  if (collapsed) {
    return (
      <NavLinkList
        items={group.items}
        pathname={pathname}
        pillCarriesBg={pillCarriesBg}
        collapsed
      />
    );
  }
  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={onToggle}
        className="mb-1.5 flex w-full items-center justify-between rounded-md px-3 py-1.5 text-h3 text-neutral-900 transition-colors hover:bg-neutral-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
      >
        <span>{t(group.labelKey)}</span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div
          inert={!expanded}
          className={`overflow-hidden transition-opacity duration-200 ease-out motion-reduce:transition-none ${
            expanded ? "opacity-100" : "opacity-0"
          }`}
        >
          <NavLinkList
            items={group.items}
            pathname={pathname}
            id={id}
            pillCarriesBg={pillCarriesBg}
          />
        </div>
      </div>
    </div>
  );
}

export default function DashboardSidebar({
  collapsed,
  onToggle,
}: {
  /** Icon-rail mode (E3). Owned by ShellFrame so the main column's left
   *  padding can switch in lockstep; persisted to localStorage there. When
   *  true the sidebar shrinks to `w-16`, drops the logo word + item labels +
   *  group captions, and centers the icons. */
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const reducedMotion = usePrefersReducedMotion();

  // Gleitende Aktiv-Pille (Konsole-v5, V5-5). Armierung in zwei Schritten,
  // damit nie ein Frame ohne Markierung entsteht: (1) der Mess-Effekt unten
  // setzt die Pille UNTER den noch per Item-Klasse gefüllten aktiven Link
  // (gleiche Farbe → pixelidentisch, unsichtbar), (2) erst der rAF-Tick
  // flippt `pillArmed` und nimmt dem Item die Fläche — ab da trägt die Pille.
  // setState im rAF-Callback (asynchron), nicht im Effekt-Body — Repo-Lint
  // verbietet synchrones setState in Effekten. Reduced-Motion armiert nie:
  // Items behalten dauerhaft die heutige statische Markierung.
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const pillPlacedRef = useRef(false);
  const [pillMounted, setPillMounted] = useState(false);
  const pillOn = pillMounted && !reducedMotion;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPillMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Open accordion sections, keyed by group.labelKey. Seeded with the group
  // that holds the active route so a deep-link never lands inside a collapsed
  // group. Per-mount session state only — no localStorage in v1.
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(activeGroupKeys(pathname)),
  );

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
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Pille positionieren — rein imperativ (Style-Writes auf dem Ref, KEIN
  // setState → kein Render-Churn, kein set-state-in-effect). Misst den
  // [data-nav-active]-Link relativ zum scrollenden <nav> und schreibt
  // Content-Koordinaten (Rect-Differenz + scrollTop), damit die absolute
  // Pille mit dem Inhalt scrollt. Animiert wird NUR transform/opacity (Breite/
  // Höhe springen — alle Items sind gleich groß, Differenzen gibt es nicht zu
  // sehen). Die Erstplatzierung läuft transitionslos, sonst gliite beim
  // Armieren ein Fleck quer durch die Sidebar. Akkordeon-Toggles verschieben
  // Items über 200 ms (grid-rows-Transition): sofort grob nachführen, das
  // bubbelnde transitionend korrigiert auf die Endlage. Kein aktives Ziel im
  // nav (z. B. Workspace-Routen) → Pille blendet aus; der eingeklappte Fall
  // ist über das inert-Attribut der Panels erkennbar.
  //
  // E3: `collapsed` steht in den Deps, weil das Ein-/Ausklappen die Item-
  // Geometrie ändert (Breite w-60⇄w-16, Captions verschwinden, Items rücken
  // ein/zentrieren) — die Pille muss neu vermessen. Den synchronen position()-
  // Lauf reicht das nur für die Endlage; die 340-ms-Breiten-Animation des
  // <aside> schiebt die Items WÄHRENDDESSEN horizontal, also lauschen wir
  // zusätzlich auf deren `width`-transitionend am <aside> (eigene Ebene, das
  // Event bubbelt NICHT in den nav hinein) und korrigieren am Animationsende.
  useEffect(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    if (reducedMotion) {
      // Live-Umschalten auf Reduced-Motion: die Items tragen ab sofort wieder
      // selbst die Fläche (pillOn=false) — die Pille darf nicht als
      // verwaister Fleck an ihrer letzten Position stehen bleiben.
      pill.style.opacity = "0";
      return;
    }

    const position = () => {
      const target = nav.querySelector<HTMLElement>('[data-nav-active="true"]');
      if (!target || target.closest("[inert]")) {
        pill.style.opacity = "0";
        return;
      }
      const navRect = nav.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const instant = !pillPlacedRef.current;
      if (instant) pill.style.transition = "none";
      pill.style.width = `${rect.width}px`;
      pill.style.height = `${rect.height}px`;
      pill.style.left = `${rect.left - navRect.left + nav.scrollLeft}px`;
      pill.style.transform = `translateY(${
        rect.top - navRect.top + nav.scrollTop
      }px)`;
      pill.style.opacity = "1";
      if (instant) {
        // Reflow erzwingen, damit die transitionslose Platzierung committed
        // ist, BEVOR die Klassen-Transition wieder greift.
        void pill.offsetWidth;
        pill.style.transition = "";
        pillPlacedRef.current = true;
      }
    };

    position();

    const onTransitionEnd = (event: TransitionEvent) => {
      // Nur die Akkordeon-Höhenanimation verschiebt Items — Hover-Farb- und
      // Chevron-Transitions bubbeln hier ständig durch und sind irrelevant.
      if (event.propertyName !== "grid-template-rows") return;
      position();
    };
    // Die Collapse-Breitenanimation läuft am <aside> (Elternebene); ihr
    // transitionend bubbelt nicht in den nav, daher ein eigener Listener dort.
    const aside = nav.parentElement;
    const onAsideTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName !== "width") return;
      position();
    };
    const onResize = () => position();
    nav.addEventListener("transitionend", onTransitionEnd);
    aside?.addEventListener("transitionend", onAsideTransitionEnd);
    window.addEventListener("resize", onResize);
    return () => {
      nav.removeEventListener("transitionend", onTransitionEnd);
      aside?.removeEventListener("transitionend", onAsideTransitionEnd);
      window.removeEventListener("resize", onResize);
    };
  }, [reducedMotion, pathname, openGroups, collapsed]);

  return (
    // E3: w-60 ⇄ w-16 Icon-Rail. Breite animiert über die View-Dauer (340 ms,
    // gleiche Kurve wie die Pille) — unter Reduced-Motion sofort. Das passende
    // Links-Padding der Hauptspalte schaltet ShellFrame im Gleichschritt.
    <aside
      className={`fixed inset-y-0 left-0 flex flex-col border-r border-neutral-200 bg-card transition-[width] duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo — eingeklappt nur die Mark, mittig (das Wort „Klymeo" entfällt). */}
      <div
        className={`flex h-14 items-center border-b border-neutral-200 ${
          collapsed ? "justify-center px-2" : "px-6"
        }`}
      >
        <Link
          href="/dashboard"
          aria-label="Klymeo"
          className="inline-flex items-center gap-2"
        >
          <KlymeoMark className="h-[22px] w-[22px] shrink-0" />
          {!collapsed && (
            <span
              className="text-lg text-neutral-900"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 500,
                letterSpacing: "-0.03em",
              }}
            >
              Klymeo
            </span>
          )}
        </Link>
      </div>

      {/* Primary nav — grouped by product module, each group collapsible.
          `relative` macht das scrollende nav zum Containing Block der
          gleitenden Aktiv-Pille (erstes Kind, paintet hinter allen späteren
          Siblings — kein z-index nötig). Der Workspace-Footer unten liegt
          bewusst AUSSERHALB: eigener Scroll-Kontext, behält die statische
          Markierung („different kind of thing", wie sein Divider sagt). */}
      <nav
        ref={navRef}
        className="isolate relative flex-1 space-y-5 overflow-y-auto px-3 py-4"
      >
        {/* -z-10 + isolate auf dem nav: die Pille ist positioniert und würde
            sonst ÜBER den nicht-positionierten Linktext painten (Paint-Order
            stellt positionierte Elemente über In-Flow-Siblings, DOM-Reihenfolge
            egal) — genau so sah der Prod-Bug aus: leerer primary-Fleck statt
            "Heute". isolate hält den negativen z-index im nav gefangen. */}
        <span
          ref={pillRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 -z-10 rounded-lg bg-primary-50 opacity-0 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        />
        {/* „Heute“ — die Startseite (Konsole-v5, O9). Top-level und ohne
            Gruppe: der Einstieg bleibt immer sichtbar, nie hinter einem
            Akkordeon. Nur solange Sales Intelligence aus ist — bei
            aktiviertem Sales-Modul gehört /dashboard wieder dessen
            Pipeline-Eintrag (kein Doppel-Highlight auf derselben Route). */}
        {!ENABLED_MODULES.salesIntelligence && (
          <NavLinkList
            items={[
              { href: "/dashboard", labelKey: "item.heute", icon: "house" },
            ]}
            pathname={pathname}
            pillCarriesBg={pillOn}
            collapsed={collapsed}
          />
        )}
        {VISIBLE_MODULES.map((group) => {
          const section = (
            <NavSection
              key={group.labelKey}
              group={group}
              pathname={pathname}
              expanded={openGroups.has(group.labelKey)}
              onToggle={() => toggleGroup(group.labelKey)}
              pillCarriesBg={pillOn}
              collapsed={collapsed}
            />
          );
          // Market Research is set apart as its own "department" — purely
          // SPATIALLY, with NO surface fill (the earlier primary-100 wash is
          // gone). A full-bleed band (the `-mx-3` cancels the nav's px-3 so the
          // rules run the full sidebar width, exactly like the Workspace
          // divider) is fenced by a thicker 2px rule above AND below and given
          // generous vertical padding, lifting it clear of the module rhythm; a
          // small, dezent uppercase eyebrow ("Externe Forschung") names the
          // department above the group caption. It does NOT move — it stays in
          // its slot between Product Discovery and Cross-Study. The band is
          // built to hold MORE products under the same eyebrow later; today it
          // carries the single Market Research accordion. With no wash, the
          // active/hover item pills (primary-50 / neutral-50) and the bold
          // violet active label read exactly as everywhere else in the sidebar.
          if (group.labelKey === "group.marketResearch") {
            return (
              <div
                key={group.labelKey}
                className="-mx-3 border-y-2 border-neutral-300 px-3 py-5"
              >
                {/* Eingeklappt entfällt der „Externe Forschung"-Eyebrow (kein
                    Platz für Text im Icon-Rail); die beiden 2px-Linien tragen
                    die Abteilungs-Abgrenzung dann allein. */}
                {!collapsed && (
                  <p className="mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                    {t("section.externalResearch")}
                  </p>
                )}
                {section}
              </div>
            );
          }
          return section;
        })}
      </nav>

      {/* Workspace — cross-cutting tools, divided from the modules above. Flat
          and always expanded (not an accordion): plumbing stays one click away.
          Eingeklappt entfällt die Caption (wie bei den Modul-Gruppen). */}
      <div className="border-t border-neutral-200 px-3 py-4">
        {!collapsed && (
          <div className="mb-1.5 px-3 text-h3 text-neutral-900">
            {t(WORKSPACE.labelKey)}
          </div>
        )}
        <NavLinkList
          items={WORKSPACE.items}
          pathname={pathname}
          collapsed={collapsed}
        />
      </div>

      {/* Collapse-Toggle (E3). Eigener Fuß unter dem Workspace-Block: ein
          Chevron, der beim Einklappen dreht (zeigt im Rail nach rechts =
          „aufklappen"). Persistenz/Zustand liegen in ShellFrame; hier nur der
          Schalter. Beschriftung absichtlich als lokales Literal statt nav.*-
          Key — ein neuer Catalog-Eintrag läge außerhalb dieser Etappe; der
          Toggle ist reine Chrome-Steuerung. Label per sr-only + title. */}
      <div
        className={`border-t border-neutral-200 px-3 py-3 ${
          collapsed ? "" : "flex justify-end"
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          title={collapsed ? COLLAPSE_LABEL.expand : COLLAPSE_LABEL.collapse}
          className={`flex items-center rounded-md py-1.5 text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 ${
            collapsed ? "w-full justify-center px-2" : "px-2"
          }`}
        >
          {/* ChevronDown (▼) als Collapse-Indikator: ausgeklappt 90° CW =
              zeigt nach links („einklappen"), eingeklappt 90° CCW = zeigt nach
              rechts („aufklappen"). Genau EINE rotate-Utility, damit die
              Drehung sauber animiert (kein konkurrierendes transform). */}
          <ChevronDownIcon
            className={`h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none ${
              collapsed ? "-rotate-90" : "rotate-90"
            }`}
          />
          <span className="sr-only">
            {collapsed ? COLLAPSE_LABEL.expand : COLLAPSE_LABEL.collapse}
          </span>
        </button>
      </div>
    </aside>
  );
}

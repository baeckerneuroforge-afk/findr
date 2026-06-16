"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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

interface NavItem {
  href: string;
  labelKey: string;
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
      { href: "/dashboard", labelKey: "item.pipeline" },
      { href: "/dashboard/forecast", labelKey: "item.forecast" },
      { href: "/dashboard/loss-analysis", labelKey: "item.lossAnalysis" },
      { href: "/dashboard/coaching", labelKey: "item.coaching" },
    ],
  },
  {
    labelKey: "group.customer",
    module: "csHealth",
    items: [
      { href: "/dashboard/accounts", labelKey: "item.accounts" },
      { href: "/dashboard/health", labelKey: "item.health" },
    ],
  },
  {
    labelKey: "group.productDiscovery",
    module: "productDiscovery",
    items: [
      { href: "/dashboard/product-discovery", labelKey: "item.productDiscovery" },
      { href: "/dashboard/research-plans", labelKey: "item.researchPlans" },
    ],
  },
  {
    labelKey: "group.marketResearch",
    module: "marketResearch",
    items: [
      { href: "/dashboard/market-research", labelKey: "item.marketResearch" },
      // Org-weiter Teilnehmer-Pool — Route bleibt /research-plans/pool;
      // isActive() trennt ihn bereits vom researchPlans-Eintrag (PD-Gruppe).
      { href: "/dashboard/research-plans/pool", labelKey: "item.participantPool" },
    ],
  },
  {
    labelKey: "group.crossStudy",
    module: "insights",
    items: [
      // Cross-Study (Mission-Control) — org-level chat ACROSS all study
      // syntheses. Lives here because it reads from every study, but it is NOT
      // inside any single study (its own top-level page).
      { href: "/dashboard/insights", labelKey: "item.crossStudy" },
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
}: {
  items: NavItem[];
  pathname: string;
  id?: string;
  pillCarriesBg?: boolean;
}) {
  const t = useTranslations("nav");
  return (
    <ul id={id} className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              data-nav-active={active ? "true" : undefined}
              className={`block rounded-lg px-3 py-1.5 text-body transition-colors ${
                active
                  ? `text-primary-700 font-medium${
                      pillCarriesBg ? "" : " bg-primary-50"
                    }`
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
}: {
  group: NavGroupDef;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  pillCarriesBg: boolean;
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

export default function DashboardSidebar() {
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
    const onResize = () => position();
    nav.addEventListener("transitionend", onTransitionEnd);
    window.addEventListener("resize", onResize);
    return () => {
      nav.removeEventListener("transitionend", onTransitionEnd);
      window.removeEventListener("resize", onResize);
    };
  }, [reducedMotion, pathname, openGroups]);

  return (
    <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-neutral-200 bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-neutral-200 px-6">
        <Link
          href="/dashboard"
          aria-label="Klymeo"
          className="inline-flex items-center gap-2"
        >
          <KlymeoMark className="h-[22px] w-[22px] shrink-0" />
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
            items={[{ href: "/dashboard", labelKey: "item.heute" }]}
            pathname={pathname}
            pillCarriesBg={pillOn}
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
                <p className="mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                  {t("section.externalResearch")}
                </p>
                {section}
              </div>
            );
          }
          return section;
        })}
      </nav>

      {/* Workspace — cross-cutting tools, divided from the modules above. Flat
          and always expanded (not an accordion): plumbing stays one click away. */}
      <div className="border-t border-neutral-200 px-3 py-4">
        <div className="mb-1.5 px-3 text-h3 text-neutral-900">
          {t(WORKSPACE.labelKey)}
        </div>
        <NavLinkList items={WORKSPACE.items} pathname={pathname} />
      </div>
    </aside>
  );
}

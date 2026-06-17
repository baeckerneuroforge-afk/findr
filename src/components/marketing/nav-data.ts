import { MODULES } from "./PlatformModules";
import { INDUSTRIES } from "./industry-template";
import type { IconName } from "./icons";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";
import { localizeHref, type Locale } from "@/i18n/marketing-locale";

/**
 * Canonical marketing-navigation registry — the SINGLE source that feeds the
 * header mega-menu, the mobile accordion, the footer columns AND the sitemap.
 *
 * Before this file the same routes were hand-listed in three independent places
 * (the header's NAV_LINKS, the footer's COLUMNS, the sitemap's routes array),
 * which could silently drift. Now every one of those is DERIVED from here, and
 * here itself composes the already-canonical per-surface registries
 * (`MODULES` / `INDUSTRIES`) so a route, label, blurb or icon is
 * declared exactly once.
 *
 * Everything here is PURE DATA (strings + icon NAME strings — no JSX, no
 * component references), so the server header can hand `PRIMARY_NAV` straight to
 * the "use client" MegaMenu / MobileNav islands as serializable props. The
 * islands resolve `icon` to a component via `ICONS` on their side of the
 * boundary. This module is only ever IMPORTED at runtime by Server Components
 * (header / footer / sitemap); the client islands import only its TYPES (erased).
 */

// ── Shared shapes ─────────────────────────────────────────────────────────────

/** A single linked entry inside a dropdown panel (icon + title + one-liner). */
export type NavLeaf = {
  label: string;
  href: string;
  desc: string;
  icon: IconName;
  status?: "Live" | "Bald";
};

/** A column within a panel. The "Plattform" panel is one unheaded group; the
 *  "Branchen" panel is one headed group (industries). `overview` is the
 *  group's optional "see all" foot-link. */
export type NavGroup = {
  heading?: string;
  items: NavLeaf[];
  overview?: { label: string; href: string };
};

/** A top-level header item: either a flat link or a panel trigger. */
export type NavEntry =
  | { kind: "flat"; label: string; href: string }
  | {
      kind: "panel";
      label: string;
      /** Top-level destination (the panel's own overview target lives on its
       *  group; this is the semantic "home" of the section). */
      href: string;
      /** Stable id stem for aria-controls + React keys. */
      id: string;
      groups: NavGroup[];
    };

// ── Leaves derived from the canonical per-surface registries ──────────────────

const moduleLeaves: NavLeaf[] = MODULES.map((m) => ({
  label: m.name,
  href: m.href,
  desc: m.blurb,
  icon: m.icon,
  status: m.status,
}));

const industryLeaves: NavLeaf[] = INDUSTRIES.map((i) => ({
  label: i.name,
  href: `/branchen/${i.slug}`,
  desc: i.tagline,
  icon: i.icon,
}));

/**
 * Die Werkzeuge der Plattform — Anker auf /produkt (dort lebt je Werkzeug eine
 * eigene Tiefen-Sektion). Alle vier sind reale, gebaute Fähigkeiten:
 * Voice-Agent (/api/interview/[token]/voice + /api/voice/*), Stimulus
 * (/api/research/plans/[id]/stimulus + Split-View im Interview), Synthese-
 * Export (synthesis/{pdf,pptx}-Routen) und Qualität/Rekrutierung (Screening-
 * Fragen, Quoten, Panel-Anbindung, offene Links, eigener Pool).
 */
const featureLeaves: NavLeaf[] = [
  {
    label: "Voice-Agent",
    href: "/produkt#voice",
    desc: "Interviews hörbar geführt — sprechen statt tippen.",
    icon: "MicIcon",
  },
  {
    label: "Stimulus",
    href: "/produkt#stimulus",
    desc: "Entwürfe & Konzepte live im Interview zeigen.",
    icon: "ImageIcon",
  },
  {
    label: "Synthese & Export",
    href: "/produkt#synthese",
    desc: "Themen, Lager, Zitate — als PDF & PowerPoint.",
    icon: "DownloadIcon",
  },
  {
    label: "Qualität & Rekrutierung",
    href: "/produkt#qualitaet",
    desc: "Screening, Quoten, Panel-Anbindung, offene Links.",
    icon: "ShieldCheckIcon",
  },
];

// ── 1) The header navigation (mega-menu + mobile accordion) ───────────────────

export const PRIMARY_NAV: NavEntry[] = [
  {
    kind: "panel",
    label: "Produkt",
    href: "/produkt",
    id: "produkt",
    groups: [
      {
        heading: "Methoden",
        items: moduleLeaves,
        overview: { label: "Plattform-Überblick", href: "/produkt" },
      },
      {
        heading: "Werkzeuge",
        items: featureLeaves,
      },
    ],
  },
  {
    kind: "panel",
    label: "Branchen",
    // No /branchen index page exists; the panel's destinations are the
    // per-industry pages below. `href` is the section's semantic home — NOT
    // rendered as a link by MegaMenu/MobileNav (the trigger is a <button>), so
    // it points at the platform page as the closest hub.
    href: "/produkt",
    id: "branchen",
    groups: [
      {
        heading: "Für wen Klymeo forscht",
        items: industryLeaves,
        // No "see all": there is no /branchen index page (plan O4).
      },
    ],
  },
  { kind: "flat", label: "Preise", href: "/preise" },
  { kind: "flat", label: "Insights", href: "/insights" },
];

// ── 2) The footer columns ─────────────────────────────────────────────────────

export type FooterLink = { label: string; href: string };
export type FooterColumn = { title: string; links: FooterLink[] };

const toLinks = (leaves: NavLeaf[]): FooterLink[] =>
  leaves.map((l) => ({ label: l.label, href: l.href }));

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Produkt",
    links: [{ label: "Plattform", href: "/produkt" }, ...toLinks(moduleLeaves)],
  },
  {
    title: "Werkzeuge",
    links: toLinks(featureLeaves),
  },
  {
    title: "Branchen",
    links: toLinks(industryLeaves),
  },
  {
    title: "Unternehmen",
    links: [
      { label: "Preise", href: "/preise" },
      { label: "Insights", href: "/insights" },
      { label: "Demo buchen", href: DEMO_BOOKING_URL },
    ],
  },
  {
    // DE-Pflicht: Impressum (verbindlicher Text, indexierbar) + Datenschutz/AGB
    // (Gerüst mit Platzhaltern bis der Rechtstext von André/Anwalt landet).
    title: "Rechtliches",
    links: [
      { label: "Impressum", href: "/impressum" },
      { label: "Datenschutz", href: "/datenschutz" },
      { label: "AGB", href: "/agb" },
    ],
  },
];

/**
 * Tailwind can only emit classes it sees as literal strings, so the footer's
 * `grid-cols` can't be templated from a number. This maps the (single-source)
 * column count to a literal class — add a column to FOOTER_COLUMNS and the grid
 * tracks it automatically as long as the matching literal exists here. Keep the
 * brand cell (1.3fr) + N link columns in lockstep with FOOTER_COLUMNS.length.
 */
export const FOOTER_GRID_BY_COLS: Record<number, string> = {
  4: "lg:grid-cols-[1.3fr_repeat(4,1fr)]",
  5: "lg:grid-cols-[1.3fr_repeat(5,1fr)]",
  6: "lg:grid-cols-[1.3fr_repeat(6,1fr)]",
};

// ── 3) The sitemap routes ─────────────────────────────────────────────────────

export type SitemapRoute = { path: string; priority: number };

/**
 * Every indexable marketing route + its priority, derived from the same leaves.
 * Article slugs are appended in sitemap.ts (they come from the insights source).
 *
 * Legal pages: /impressum carries the binding text and is listed (low priority).
 * /datenschutz + /agb stay OUT while they hold placeholders — add them here once
 * the real legal text lands so the sitemap doesn't advertise placeholder pages.
 */
export const SITEMAP_ROUTES: SitemapRoute[] = [
  { path: "/", priority: 1.0 },
  { path: "/produkt", priority: 0.8 },
  // The four method pages (/methoden/<slug>), derived from the same MODULES
  // leaves the mega-menu + footer use — so each route is declared exactly once.
  // The Werkzeuge leaves are anchors on /produkt and deliberately NOT listed
  // (fragments don't belong in a sitemap).
  ...moduleLeaves.map((l) => ({ path: l.href, priority: 0.7 })),
  { path: "/preise", priority: 0.8 },
  ...industryLeaves.map((l) => ({ path: l.href, priority: 0.7 })),
  { path: "/insights", priority: 0.6 },
  { path: "/demo", priority: 0.5 },
  { path: "/impressum", priority: 0.3 },
];

// ── 4) Locale-aware link mapping (DE/EN routing) ──────────────────────────────

/**
 * Return a copy of the header nav with every INTERNAL href localized to the
 * given locale (external / cross-root hrefs pass through untouched via
 * localizeHref). Pure data → the server header maps ONCE and hands the result
 * to the client islands (MegaMenu / MobileNav), which stay locale-agnostic and
 * just render whatever hrefs they receive. Labels are unchanged here — copy
 * extraction is a later etappe.
 */
export function localizeNav(nav: NavEntry[], locale: Locale): NavEntry[] {
  return nav.map((entry) => {
    if (entry.kind === "flat") {
      return { ...entry, href: localizeHref(locale, entry.href) };
    }
    return {
      ...entry,
      href: localizeHref(locale, entry.href),
      groups: entry.groups.map((group) => ({
        ...group,
        items: group.items.map((leaf) => ({
          ...leaf,
          href: localizeHref(locale, leaf.href),
        })),
        overview: group.overview
          ? { ...group.overview, href: localizeHref(locale, group.overview.href) }
          : undefined,
      })),
    };
  });
}

/** Footer columns with every internal link localized (the external "Demo buchen"
 *  Cal link passes through untouched via localizeHref). */
export function localizeFooterColumns(
  columns: FooterColumn[],
  locale: Locale,
): FooterColumn[] {
  return columns.map((col) => ({
    ...col,
    links: col.links.map((l) => ({ ...l, href: localizeHref(locale, l.href) })),
  }));
}

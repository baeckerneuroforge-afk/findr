import { getModules } from "./PlatformModules";
import { getIndustries } from "./industry-template";
import { getLiveUseCases, getUseCaseHref } from "./use-cases-data";
import type { IconName } from "./icons";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";
import {
  localizeHref,
  localizedContent,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";

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
// All get*Leaves factories localize BOTH the label/desc (via the per-surface
// registries / bilingual literals) AND the href (via localizeHref). The `de`
// branch yields the exact original strings + bare hrefs (R1: byte-identical).

const getModuleLeaves = (locale: Locale): NavLeaf[] =>
  getModules(locale).map((m) => ({
    label: m.name,
    href: localizeHref(locale, m.href),
    desc: m.blurb,
    icon: m.icon,
    status: m.status,
  }));

const getIndustryLeaves = (locale: Locale): NavLeaf[] =>
  getIndustries(locale).map((i) => ({
    label: i.name,
    href: localizeHref(locale, `/branchen/${i.slug}`),
    desc: i.tagline,
    icon: i.icon,
  }));

// Die ANWENDUNGSFÄLLE (Use Cases) — nur die LIVE Fälle (Marktforschung, User
// Research) bekommen Nav-/Footer-/Sitemap-Einträge; "prepared" (Personas)
// erscheint ausschließlich als deaktiviertes Element im Homepage-Grid. Kein
// `status` → keine Live/Bald-Pille im Menü.
const getUseCaseLeaves = (locale: Locale): NavLeaf[] =>
  getLiveUseCases(locale).map((u) => ({
    label: u.name,
    href: localizeHref(locale, getUseCaseHref(u.slug)),
    desc: u.tagline,
    icon: u.icon,
  }));

/**
 * Die Werkzeuge der Plattform — Anker auf /produkt (dort lebt je Werkzeug eine
 * eigene Tiefen-Sektion). Alle vier sind reale, gebaute Fähigkeiten:
 * Voice-Agent (/api/interview/[token]/voice + /api/voice/*), Stimulus
 * (/api/research/plans/[id]/stimulus + Split-View im Interview), Synthese-
 * Export (synthesis/{pdf,pptx}-Routen) und Qualität/Rekrutierung (Screening-
 * Fragen, Quoten, Panel-Anbindung, offene Links, eigener Pool).
 *
 * `Voice-Agent`/`Stimulus` are proper nouns → not translated. Hrefs are anchors
 * on /produkt; localizeHref prefixes the path and keeps the #fragment.
 */
type FeatureLeafData = {
  label: { de: string; en: string };
  href: string;
  desc: { de: string; en: string };
  icon: IconName;
};

const FEATURE_LEAF_DATA: FeatureLeafData[] = [
  {
    label: { de: "Voice-Agent", en: "Voice Agent" },
    href: "/produkt#voice",
    desc: {
      de: "Interviews hörbar geführt — sprechen statt tippen.",
      en: "Interviews led audibly — speak instead of type.",
    },
    icon: "MicIcon",
  },
  {
    label: { de: "Stimulus", en: "Stimulus" },
    href: "/produkt#stimulus",
    desc: {
      de: "Entwürfe & Konzepte live im Interview zeigen.",
      en: "Show drafts & concepts live in the interview.",
    },
    icon: "ImageIcon",
  },
  {
    label: { de: "Synthese & Export", en: "Synthesis & Export" },
    href: "/produkt#synthese",
    desc: {
      de: "Themen, Lager, Zitate — als PDF & PowerPoint.",
      en: "Themes, camps, quotes — as PDF & PowerPoint.",
    },
    icon: "DownloadIcon",
  },
  {
    label: { de: "Qualität & Rekrutierung", en: "Quality & Recruitment" },
    href: "/produkt#qualitaet",
    desc: {
      de: "Screening, Quoten, Panel-Anbindung, offene Links.",
      en: "Screening, quotas, panel integration, open links.",
    },
    icon: "ShieldCheckIcon",
  },
];

export const getFeatureLeaves = (locale: Locale): NavLeaf[] =>
  FEATURE_LEAF_DATA.map((f) => ({
    label: localizedContent(locale, f.label),
    href: localizeHref(locale, f.href),
    desc: localizedContent(locale, f.desc),
    icon: f.icon,
  }));

// ── 1) The header navigation (mega-menu + mobile accordion) ───────────────────

/**
 * The header nav, localized in ONE place: labels/headings/overview via
 * localizedContent, leaf labels+hrefs via the get*Leaves factories, top-level
 * hrefs via localizeHref. The `de` branch reproduces the original PRIMARY_NAV
 * verbatim (R1). Replaces the old `localizeNav` (which rewrote hrefs only) — the
 * server header now calls this directly and hands the result to the islands.
 */
export function getPrimaryNav(locale: Locale): NavEntry[] {
  return [
    {
      // Die „Dafür nutzt du Klymeo"-Ebene (Outset-Modell), Spitze der Nav.
      kind: "panel",
      label: localizedContent(locale, { de: "Lösungen", en: "Solutions" }),
      href: localizeHref(locale, "/loesungen"),
      id: "loesungen",
      groups: [
        {
          heading: localizedContent(locale, {
            de: "Dafür nutzt du Klymeo",
            en: "What you use Klymeo for",
          }),
          items: getUseCaseLeaves(locale),
          overview: {
            label: localizedContent(locale, {
              de: "Alle Anwendungsfälle",
              en: "All use cases",
            }),
            href: localizeHref(locale, "/loesungen"),
          },
        },
      ],
    },
    {
      kind: "panel",
      label: localizedContent(locale, { de: "Produkt", en: "Product" }),
      href: localizeHref(locale, "/produkt"),
      id: "produkt",
      groups: [
        {
          heading: localizedContent(locale, { de: "Methoden", en: "Methods" }),
          items: getModuleLeaves(locale),
          overview: {
            label: localizedContent(locale, {
              de: "Plattform-Überblick",
              en: "Platform overview",
            }),
            href: localizeHref(locale, "/produkt"),
          },
        },
        {
          heading: localizedContent(locale, { de: "Werkzeuge", en: "Tools" }),
          items: getFeatureLeaves(locale),
        },
      ],
    },
    {
      kind: "panel",
      label: localizedContent(locale, { de: "Branchen", en: "Industries" }),
      // No /branchen index page exists; the panel's destinations are the
      // per-industry pages below. `href` is the section's semantic home — NOT
      // rendered as a link by MegaMenu/MobileNav (the trigger is a <button>), so
      // it points at the platform page as the closest hub.
      href: localizeHref(locale, "/produkt"),
      id: "branchen",
      groups: [
        {
          heading: localizedContent(locale, {
            de: "Für wen Klymeo forscht",
            en: "Who Klymeo researches for",
          }),
          items: getIndustryLeaves(locale),
          // No "see all": there is no /branchen index page (plan O4).
        },
      ],
    },
    {
      kind: "flat",
      label: localizedContent(locale, { de: "Preise", en: "Pricing" }),
      href: localizeHref(locale, "/preise"),
    },
    {
      kind: "flat",
      label: localizedContent(locale, { de: "Insights", en: "Insights" }),
      href: localizeHref(locale, "/insights"),
    },
  ];
}

/** Back-compat DE export (importers that don't pass a locale get German). */
export const PRIMARY_NAV: NavEntry[] = getPrimaryNav(MARKETING_DEFAULT_LOCALE);

// ── 2) The footer columns ─────────────────────────────────────────────────────

export type FooterLink = { label: string; href: string };
export type FooterColumn = { title: string; links: FooterLink[] };

const toLinks = (leaves: NavLeaf[]): FooterLink[] =>
  leaves.map((l) => ({ label: l.label, href: l.href }));

/**
 * The footer columns, localized in ONE place: column titles + standalone link
 * labels via localizedContent, the module/feature/industry links via the
 * get*Leaves factories (label + href already localized), the remaining internal
 * hrefs via localizeHref. The external "Demo buchen" Cal link passes through
 * untouched. The `de` branch reproduces the original FOOTER_COLUMNS verbatim
 * (R1). Replaces the old `localizeFooterColumns` (href-only rewrite).
 */
export function getFooterColumns(locale: Locale): FooterColumn[] {
  return [
    {
      title: localizedContent(locale, { de: "Lösungen", en: "Solutions" }),
      links: [
        {
          label: localizedContent(locale, {
            de: "Anwendungsfälle",
            en: "Use cases",
          }),
          href: localizeHref(locale, "/loesungen"),
        },
        ...toLinks(getUseCaseLeaves(locale)),
      ],
    },
    {
      title: localizedContent(locale, { de: "Produkt", en: "Product" }),
      links: [
        {
          label: localizedContent(locale, { de: "Plattform", en: "Platform" }),
          href: localizeHref(locale, "/produkt"),
        },
        ...toLinks(getModuleLeaves(locale)),
      ],
    },
    {
      title: localizedContent(locale, { de: "Werkzeuge", en: "Tools" }),
      links: toLinks(getFeatureLeaves(locale)),
    },
    {
      title: localizedContent(locale, { de: "Branchen", en: "Industries" }),
      links: toLinks(getIndustryLeaves(locale)),
    },
    {
      title: localizedContent(locale, { de: "Unternehmen", en: "Company" }),
      links: [
        {
          label: localizedContent(locale, { de: "Preise", en: "Pricing" }),
          href: localizeHref(locale, "/preise"),
        },
        {
          label: localizedContent(locale, { de: "Insights", en: "Insights" }),
          href: localizeHref(locale, "/insights"),
        },
        {
          label: localizedContent(locale, { de: "Demo buchen", en: "Book a demo" }),
          href: localizeHref(locale, DEMO_BOOKING_URL),
        },
      ],
    },
    {
      // DE-Pflicht: Impressum (verbindlicher Text, indexierbar) + Datenschutz/AGB
      // (Gerüst mit Platzhaltern bis der Rechtstext von André/Anwalt landet).
      title: localizedContent(locale, { de: "Rechtliches", en: "Legal" }),
      links: [
        {
          label: localizedContent(locale, { de: "Impressum", en: "Imprint" }),
          href: localizeHref(locale, "/impressum"),
        },
        {
          label: localizedContent(locale, { de: "Datenschutz", en: "Privacy" }),
          href: localizeHref(locale, "/datenschutz"),
        },
        {
          label: localizedContent(locale, { de: "Cookies", en: "Cookies" }),
          href: localizeHref(locale, "/cookies"),
        },
        {
          label: localizedContent(locale, { de: "AGB", en: "Terms" }),
          href: localizeHref(locale, "/agb"),
        },
      ],
    },
  ];
}

/** Back-compat DE export (importers that don't pass a locale get German). */
export const FOOTER_COLUMNS: FooterColumn[] = getFooterColumns(MARKETING_DEFAULT_LOCALE);

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
 * Legal pages: /impressum (binding) plus /datenschutz + /agb are all listed
 * (low priority). The latter two are detailed DRAFTS (ENTWURF banner + {{ }}
 * markers until the final lawyer-reviewed text lands) but are advertised on
 * André's decision so the legal pages are findable; revisit priority once the
 * binding text is in.
 */
// SITEMAP paths are locale-INVARIANT bare paths — sitemap.ts applies the /de
// prefix itself (localizePath). Derive the method/industry routes from the bare
// hrefs/slugs in the DE registries (getModules/getIndustries), NOT from the
// get*Leaves factories (those localize hrefs to /de/…).
const SITEMAP_MODULES = getModules(MARKETING_DEFAULT_LOCALE);
const SITEMAP_INDUSTRIES = getIndustries(MARKETING_DEFAULT_LOCALE);
// Nur die LIVE Anwendungsfälle sind indexierbar — "prepared" (Personas) hat
// keine Seite und gehört nicht in die Sitemap.
const SITEMAP_USE_CASES = getLiveUseCases(MARKETING_DEFAULT_LOCALE);

export const SITEMAP_ROUTES: SitemapRoute[] = [
  { path: "/", priority: 1.0 },
  // Die „Dafür nutzt du Klymeo"-Ebene: Hub + die zwei Live-Use-Cases. Top of
  // funnel → höhere Priorität als die Engine-/Methoden-/Branchen-Seiten.
  { path: "/loesungen", priority: 0.9 },
  ...SITEMAP_USE_CASES.map((u) => ({
    path: getUseCaseHref(u.slug),
    priority: 0.85,
  })),
  { path: "/produkt", priority: 0.8 },
  // The four method pages (/methoden/<slug>), derived from the same MODULES
  // the mega-menu + footer use — so each route is declared exactly once.
  // The Werkzeuge leaves are anchors on /produkt and deliberately NOT listed
  // (fragments don't belong in a sitemap).
  ...SITEMAP_MODULES.map((m) => ({ path: m.href, priority: 0.7 })),
  { path: "/preise", priority: 0.8 },
  ...SITEMAP_INDUSTRIES.map((i) => ({ path: `/branchen/${i.slug}`, priority: 0.7 })),
  { path: "/insights", priority: 0.6 },
  { path: "/demo", priority: 0.5 },
  { path: "/impressum", priority: 0.3 },
  { path: "/datenschutz", priority: 0.3 },
  { path: "/cookies", priority: 0.3 },
  { path: "/agb", priority: 0.3 },
];

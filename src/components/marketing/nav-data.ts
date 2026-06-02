import { MODULES } from "./PlatformModules";
import { ROLES } from "./role-template";
import { INDUSTRIES } from "./industry-template";
import type { IconName } from "./icons";

/**
 * Canonical marketing-navigation registry — the SINGLE source that feeds the
 * header mega-menu, the mobile accordion, the footer columns AND the sitemap.
 *
 * Before this file the same routes were hand-listed in three independent places
 * (the header's NAV_LINKS, the footer's COLUMNS, the sitemap's routes array),
 * which could silently drift. Now every one of those is DERIVED from here, and
 * here itself composes the already-canonical per-surface registries
 * (`MODULES` / `ROLES` / `INDUSTRIES`) so a route, label, blurb or icon is
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
 *  "Lösungen" panel is two headed groups (roles / industries). `overview` is the
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

const roleLeaves: NavLeaf[] = ROLES.map((r) => ({
  label: r.name,
  href: `/loesungen/${r.slug}`,
  desc: r.painTeaser,
  icon: r.icon,
}));

const industryLeaves: NavLeaf[] = INDUSTRIES.map((i) => ({
  label: i.name,
  href: `/branchen/${i.slug}`,
  desc: i.tagline,
  icon: i.icon,
}));

// ── 1) The header navigation (mega-menu + mobile accordion) ───────────────────

export const PRIMARY_NAV: NavEntry[] = [
  {
    kind: "panel",
    label: "Plattform",
    href: "/produkt",
    id: "plattform",
    groups: [
      {
        items: moduleLeaves,
        overview: { label: "Plattform-Überblick", href: "/produkt" },
      },
    ],
  },
  {
    kind: "panel",
    label: "Lösungen",
    href: "/loesungen",
    id: "loesungen",
    groups: [
      {
        heading: "Für SaaS-Teams",
        items: roleLeaves,
        overview: { label: "Alle Lösungen", href: "/loesungen" },
      },
      {
        heading: "Für Marken & Marktforschung",
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
    title: "Lösungen",
    links: [{ label: "Übersicht", href: "/loesungen" }, ...toLinks(roleLeaves)],
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
      { label: "Demo buchen", href: "/demo" },
    ],
  },
  {
    // DE-Pflicht: Impressum/Datenschutz/AGB (Etappe-D scaffolding, noindex).
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
 * Legal pages are deliberately absent — they ship noindex (Etappe D, decision D8).
 */
export const SITEMAP_ROUTES: SitemapRoute[] = [
  { path: "/", priority: 1.0 },
  { path: "/produkt", priority: 0.8 },
  ...moduleLeaves.map((l) => ({ path: l.href, priority: 0.8 })),
  { path: "/preise", priority: 0.8 },
  { path: "/loesungen", priority: 0.7 },
  ...roleLeaves.map((l) => ({ path: l.href, priority: 0.7 })),
  ...industryLeaves.map((l) => ({ path: l.href, priority: 0.7 })),
  { path: "/insights", priority: 0.6 },
  { path: "/demo", priority: 0.5 },
];

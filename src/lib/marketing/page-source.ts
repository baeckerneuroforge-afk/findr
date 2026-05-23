import "server-only";

import fs from "node:fs";
import path from "node:path";

/**
 * Marketing pages (landing `/`, pricing `/pricing`) are authored as
 * self-contained HTML in src/marketing/*.html (inline <style> + <script>). To
 * preserve every animation/interaction byte-for-byte we don't re-implement them
 * in React — we read the source file at build time, split out the CSS, the body
 * markup, and the JS, and render them faithfully (CSS + markup server-side,
 * JS via MarketingScripts in a client effect).
 *
 * This runs during static prerender (no per-request work), so the extracted
 * strings are baked into the prerendered output.
 */

export interface MarketingPageParts {
  css: string;
  html: string;
  js: string;
}

/**
 * The source file styles a standalone page (white `body`). In the app the root
 * <body> carries the dark dashboard classes (bg-obsidian, text-white, flex), so
 * we replace the source's `body { … }` rule with one that (a) uses the
 * already-loaded next/font Inter via var(--font-inter) instead of the bare
 * 'Inter' literal, and (b) reclaims the white background / ink text / block flow
 * with !important so the marketing look wins while these routes are mounted.
 */
const BODY_RULE_REPLACEMENT =
  "body{font-family:var(--font-inter),'Inter',system-ui,-apple-system,sans-serif;color:var(--ink)!important;background:var(--bg)!important;display:block!important;line-height:1.55;overflow-x:hidden;-webkit-font-smoothing:antialiased;}";

/**
 * The Qwen marketing HTML is auth-less. We add the app's Clerk entry points
 * (Log in -> /sign-in, Start free trial -> /sign-up) as plain links in the nav,
 * styled on-brand. Plain <a>s work inside dangerouslySetInnerHTML and hit the
 * existing Clerk catch-all routes — the same route-link method the old landing
 * used (which linked to /sign-in). Clerk drives the rest (and redirects already
 * signed-in users to /dashboard via the provider's fallback URLs).
 */
const AUTH_NAV_CSS = `
/* App auth entry points injected into the marketing nav */
.nav-actions{display:flex;align-items:center;gap:12px;}
.nav-login{font-size:13px;font-weight:500;color:var(--ink);padding:10px 4px;transition:color .2s ease;}
.nav-login:hover{color:var(--purple);}
.nav-signup{background:var(--purple);color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;font-weight:500;transition:background .2s ease,transform .2s ease;}
.nav-signup:hover{background:#4A22B0;transform:translateY(-1px);}
@media (max-width:600px){.nav-login{display:none;}}
`;

/**
 * Replace the standalone "Book a demo" nav button with a grouped right-side
 * cluster: Log in · Start free trial · Book a demo. The demo button keeps its
 * original (dummy) href.
 */
function injectAuthNav(html: string): string {
  return html.replace(
    /<a\s+href="([^"]*)"\s+class="nav-cta">Book a demo<\/a>/,
    (_match, demoHref: string) =>
      `<div class="nav-actions">` +
      `<a href="/sign-in" class="nav-login">Log in</a>` +
      `<a href="/sign-up" class="nav-signup">Start free trial</a>` +
      `<a href="${demoHref}" class="nav-cta">Book a demo</a>` +
      `</div>`,
  );
}

function firstMatch(source: string, re: RegExp): string {
  return source.match(re)?.[1] ?? "";
}

/**
 * Load a marketing HTML file and split it into { css, html, js }.
 * `links` are literal find/replace pairs applied to the markup so the source's
 * .html hrefs (pricing.html, index.html#…) point at Next routes instead.
 */
export function loadMarketingPage(
  fileName: string,
  links: Array<[string, string]> = [],
): MarketingPageParts {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "src", "marketing", fileName),
    "utf8",
  );

  const css =
    firstMatch(raw, /<style[^>]*>([\s\S]*?)<\/style>/i).replace(
      /body\s*\{[\s\S]*?\}/,
      BODY_RULE_REPLACEMENT,
    ) + AUTH_NAV_CSS;

  const js = firstMatch(raw, /<script[^>]*>([\s\S]*?)<\/script>/i);

  let html = firstMatch(raw, /<body[^>]*>([\s\S]*?)<\/body>/i).replace(
    /<script[\s\S]*?<\/script>/i,
    "",
  );
  for (const [from, to] of links) html = html.split(from).join(to);
  html = injectAuthNav(html);

  return { css, html, js };
}

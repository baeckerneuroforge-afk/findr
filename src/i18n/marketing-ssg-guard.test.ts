import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SSG regression guard for the public marketing tree.
 *
 * The whole DE/EN routing design depends on the (marketing) subtree resolving
 * its locale from the URL [lang] segment ONLY — never from a cookie/header. A
 * single request-time read (cookies()/headers() via next/headers, a dynamic
 * `searchParams`, or the dashboard's cookie-based getLocale()) would flip the
 * entire subtree to ƒ-dynamic and destroy the static prerendering. This test
 * fails fast if any such call sneaks into a marketing source file, so we don't
 * have to catch it by eyeballing a `next build` route table.
 */
// The public marketing routes moved to the flat (site) tree; the legacy
// (marketing)/[lang] route tree was removed. The shared marketing components
// survive (still used by the (app)/(participant) not-found pages), so the
// "no request-time dynamic state" invariant is still guarded here — PLUS the
// live (site) tree, its shared components, the marketing SEO/locale helpers,
// and the new English tree at src/app/en (which must stay just as static, or
// hreflang-driven crawling and the additive DE/EN rollout both break).
const ROOTS = [
  "src/components/marketing",
  "src/app/(site)",
  "src/components/site",
  "src/lib/marketing",
  "src/app/en",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

// Drop block + line comments so prose that merely MENTIONS these APIs (the
// layout docblock explains why it avoids getLocale(); a page comment notes "no
// searchParams") doesn't trip the guard — only real code counts.
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("marketing tree stays statically renderable", () => {
  const files = ROOTS.flatMap((r) => walk(r));

  it("collected the marketing source files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("never reads request-time dynamic state (cookies/headers/searchParams/getLocale)", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      if (/from\s+["']next\/headers["']/.test(code)) {
        offenders.push(`${file}: imports next/headers`);
      }
      // Real next/headers cookies() calls always have empty parens — require
      // that shape so English legal prose like "cookies (language, display)"
      // (a real phrase in the EN cookies/privacy pages) doesn't false-positive.
      if (/\bcookies\s*\(\s*\)/.test(code)) offenders.push(`${file}: cookies()`);
      if (/\bsearchParams\b/.test(code)) offenders.push(`${file}: searchParams`);
      if (/\bgetLocale\s*\(/.test(code)) offenders.push(`${file}: getLocale()`);
    }
    expect(offenders).toEqual([]);
  });
});

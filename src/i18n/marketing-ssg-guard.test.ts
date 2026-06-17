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
const ROOTS = ["src/app/(marketing)", "src/components/marketing"];

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
      if (/\bcookies\s*\(/.test(code)) offenders.push(`${file}: cookies()`);
      if (/\bsearchParams\b/.test(code)) offenders.push(`${file}: searchParams`);
      if (/\bgetLocale\s*\(/.test(code)) offenders.push(`${file}: getLocale()`);
    }
    expect(offenders).toEqual([]);
  });
});

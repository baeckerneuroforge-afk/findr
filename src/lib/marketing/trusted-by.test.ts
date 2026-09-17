import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-scan of the shipped homepage entry points. Reads the real DE/EN
 * page files (not a reimplementation) and follows their TrustedBy import
 * to the shared copy module — so a missing import, a leftover 312 chip,
 * or a copy-only rewrite without yfood all fail.
 */
const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function landingBundle(pageRel: string): { page: string; bundle: string } {
  const page = read(pageRel);
  expect(
    page,
    `${pageRel} must render the shared TrustedBy strip`,
  ).toMatch(/from ["']@\/components\/site\/TrustedBy["']/);

  const component = read("src/components/site/TrustedBy.tsx");
  expect(component).toMatch(/from ["']@\/lib\/marketing\/trusted-by["']/);

  const copy = read("src/lib/marketing/trusted-by.ts");
  return { page, bundle: `${page}\n${component}\n${copy}` };
}

describe("homepage Trusted by strip (shipped sources)", () => {
  const de = landingBundle("src/app/(site)/page.tsx");
  const en = landingBundle("src/app/en/page.tsx");

  it("names yfood on both locale landings", () => {
    expect(de.bundle, "DE landing tree").toMatch(/yfood/i);
    expect(en.bundle, "EN landing tree").toMatch(/yfood/i);
  });

  it("uses Trusted by / German equivalent on the matching locale", () => {
    expect(de.page).toMatch(/<TrustedBy\s+lang="de"/);
    expect(en.page).toMatch(/<TrustedBy\s+lang="en"/);
    expect(de.bundle).toMatch(/Im Einsatz bei/);
    expect(en.bundle).toMatch(/Trusted by/);
  });

  it("drops the fabricated 312-interview chip from both homepages", () => {
    expect(de.page).not.toMatch(/312 Interviews/i);
    expect(en.page).not.toMatch(/312 interviews/i);
    expect(de.page).not.toMatch(/312/);
    expect(en.page).not.toMatch(/312/);
  });

  it("self-hosts the yfood wordmark instead of hotlinking a CDN", () => {
    const mark = join(ROOT, "public/site/yfood-wordmark.svg");
    expect(existsSync(mark), "public/site/yfood-wordmark.svg").toBe(true);
    const svg = readFileSync(mark, "utf8");
    expect(svg).toMatch(/<svg/i);
    expect(svg).toMatch(/yfood/i);
    const copy = read("src/lib/marketing/trusted-by.ts");
    expect(copy).toMatch(/\/site\/yfood-wordmark\.svg/);
    expect(copy).not.toMatch(/cdn\.shop|yfood\.com\/cdn/i);
  });
});

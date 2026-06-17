"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  localeOfPath,
  localizePath,
  MARKETING_LOCALES,
  stripLocalePrefix,
  toBcp47,
} from "@/i18n/marketing-locale";

/**
 * DE/EN language switch for the public marketing chrome.
 *
 * Unlike the dashboard LanguageSwitcher (cookie + setLocale server action +
 * router.refresh), this is a PURE <Link>: the marketing locale lives in the URL
 * [lang] segment, so switching just navigates to the mirrored path
 * (/de/produkt ⇄ /en/produkt). No cookie, no server action, no provider, no
 * client catalog — the marketing tree stays statically rendered.
 *
 * The current path is read with usePathname(); the active locale renders as
 * plain text, the other(s) as links to the same page in that locale.
 */
export function MarketingLanguageSwitcher({
  className = "",
  onNavigate,
}: {
  className?: string;
  /** Called when a locale link is clicked — e.g. to close the mobile menu. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "/";
  const active = localeOfPath(pathname);
  const bare = stripLocalePrefix(pathname);

  return (
    <div
      role="group"
      aria-label="Sprache / Language"
      className={`inline-flex items-center gap-1.5 font-mono text-[11.5px] uppercase tracking-[0.14em] ${className}`}
    >
      {MARKETING_LOCALES.map((loc, i) => (
        <Fragment key={loc}>
          {i > 0 ? (
            <span aria-hidden className="text-neutral-300">
              /
            </span>
          ) : null}
          {loc === active ? (
            <span aria-current="true" className="text-neutral-900">
              {loc}
            </span>
          ) : (
            <Link
              href={localizePath(loc, bare)}
              hrefLang={toBcp47(loc)}
              onClick={onNavigate}
              aria-label={
                loc === "de" ? "Auf Deutsch wechseln" : "Switch to English"
              }
              className="rounded text-neutral-500 transition-colors hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
            >
              {loc}
            </Link>
          )}
        </Fragment>
      ))}
    </div>
  );
}

export default MarketingLanguageSwitcher;

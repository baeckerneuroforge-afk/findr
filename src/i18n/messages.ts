import type { Locale } from "./locale";
import de from "../../messages/de.json";
import en from "../../messages/en.json";

/**
 * The message catalogs, keyed by locale. Single source of truth for BOTH
 * next-intl (client chrome, via the request config + provider) and the
 * server-direct reader below (emails + metadata), which run OUTSIDE any
 * request/cookie scope and therefore can't use next-intl's request-scoped t().
 */
export const MESSAGES = { de, en };

/**
 * Resolve a dotted message key (e.g. "email.research.invite.subject") against
 * the locale catalog and interpolate {var} placeholders. Plain substitution —
 * NOT ICU — which is all the pilot strings need and keeps apostrophes literal.
 *
 * Used where next-intl's request-scoped t() can't reach:
 *   - the email builders (cron / route handlers, no cookie), and
 *   - generateMetadata (locale comes from the session, not the request).
 * The client chrome uses useTranslations("interview") instead.
 *
 * Does NOT HTML-escape. Callers interpolating into HTML must pass pre-escaped
 * values (see the email builders' htmlVars).
 */
export function translate(
  locale: Locale,
  key: string,
  vars: Record<string, string | number> = {},
): string {
  const raw = key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      MESSAGES[locale],
    );
  if (typeof raw !== "string") {
    throw new Error(`[i18n] missing message "${key}" for locale "${locale}"`);
  }
  return raw.replace(/\{(\w+)\}/g, (_match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name)
      ? String(vars[name])
      : `{${name}}`,
  );
}

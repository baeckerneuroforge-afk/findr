import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locale";
import { MESSAGES } from "./messages";

/**
 * next-intl "i18n without routing": there is no [locale] URL segment. The
 * request-global locale is resolved here from LOCALE_COOKIE (set by a future UI
 * switcher), falling back to DEFAULT_LOCALE. cookies() is async in Next 16.
 *
 * The participant interview subtree does NOT rely on this resolver — it wraps
 * its children in its own NextIntlClientProvider with the SESSION's locale (see
 * src/app/interview/[token]/page.tsx), because that locale lives behind an
 * unguessable token, not in a cookie.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieValue = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;
  return { locale, messages: MESSAGES[locale] };
});

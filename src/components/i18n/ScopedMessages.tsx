import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";
import {
  pickClientMessages,
  type ClientMessageNamespace,
} from "@/i18n/client-messages";

/**
 * Sektions-Provider für schwere i18n-Namespaces (siehe
 * src/i18n/client-messages.ts für das Warum und die Merge-Semantik).
 *
 * Server Component — in Sektions-Layouts (oder einzelne Pages) einhängen:
 *   <ScopedMessages namespaces={["research", "kalender"]}>{children}</ScopedMessages>
 *
 * Liefert IMMER die CORE-Namespaces mit, weil ein verschachtelter
 * NextIntlClientProvider die Parent-Messages ersetzt statt merged.
 */
export async function ScopedMessages({
  namespaces,
  children,
}: {
  namespaces: readonly ClientMessageNamespace[];
  children: React.ReactNode;
}) {
  const resolved = await getLocale();
  const locale: Locale = isLocale(resolved) ? resolved : DEFAULT_LOCALE;
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={pickClientMessages(locale, namespaces)}
    >
      {children}
    </NextIntlClientProvider>
  );
}

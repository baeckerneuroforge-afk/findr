import type { Locale } from "./locale";
import { MESSAGES } from "./messages";

/**
 * Client-Provider-Split (Perf): Der NextIntlClientProvider im (app)-Root
 * serialisierte früher 17 Namespaces (~137 kB von 153 kB Katalog) in den
 * RSC-Payload JEDER Dashboard-Seite und jeder Client-Navigation. Jetzt liefert
 * der Root nur noch den Kern (Shell-Chrome), und jede Dashboard-Sektion legt
 * per <ScopedMessages> ihre eigenen schweren Namespaces dazu.
 *
 * WICHTIG (verifiziert an use-intl@4.13 IntlProvider): Ein verschachtelter
 * Provider mit `messages` ERSETZT die Parent-Messages vollständig (kein Merge —
 * `messages === undefined ? prevContext?.messages : messages`). Deshalb nimmt
 * pickClientMessages die CORE-Namespaces IMMER mit auf: Komponenten unterhalb
 * eines Sektions-Providers (Toast, ErrorState, UserMenu-Portal, …) behalten so
 * ihren Zugriff auf nav/command/common/settings/heute.
 *
 * CORE = alles, was die globale Shell (Sidebar, Header, CommandPalette,
 * Begrüßung, Toast/ErrorState, UserMenu) client-seitig liest — zusammen ~12 kB:
 *   nav      → DashboardSidebar
 *   command  → GlobalSearchTrigger, CommandPalette (bare useTranslations(),
 *              nutzt ausschließlich "command.*"-Keys), KonsoulInlineAnswer
 *   common   → Toast, ErrorState, ThemeSwitcher, LanguageSwitcher, OrgDisplay,
 *              OnboardingChecklist
 *   settings → UserMenu (Header), SettingsNav
 *   heute    → HeuteGreeting (Startseite; Prod-Befund 2026-06-11: fehlt der
 *              Namespace, rendert next-intl rohe Keypfade)
 *
 * Beim Hinzufügen einer neuen Client-Komponente mit useTranslations("<ns>"):
 * prüfen, ob die Sektion, in der sie mountet, den Namespace bereits per
 * ScopedMessages bereitstellt — sonst dort ergänzen (Symptom sonst: rohe
 * Keypfade im UI, kein Build-Fehler).
 */
export const CORE_CLIENT_NAMESPACES = [
  "nav",
  "command",
  "common",
  "settings",
  "heute",
] as const;

export type ClientMessageNamespace = keyof (typeof MESSAGES)["de"];

export function pickClientMessages(
  locale: Locale,
  extra: readonly ClientMessageNamespace[] = [],
): Record<string, unknown> {
  const catalog = MESSAGES[locale] as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const ns of [...CORE_CLIENT_NAMESPACES, ...extra]) {
    if (ns in catalog) picked[ns] = catalog[ns];
  }
  return picked;
}

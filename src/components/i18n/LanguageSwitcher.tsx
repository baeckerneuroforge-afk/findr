"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { LOCALES, type Locale } from "@/i18n/locale";
import { setLocale } from "@/lib/i18n/locale-actions";

/**
 * Visible DE/EN language switch for the dashboard chrome. On change it calls
 * the setLocale server action (writes the klymeo.locale cookie + Clerk
 * publicMetadata) and refreshes so Server Components re-render in the new
 * locale — the locale is resolved server-side from the cookie, not patched in
 * on the client.
 *
 * variant:
 *   - "header"   — compact segmented [DE | EN] control next to the user menu.
 *   - "settings" — labeled row for the settings page.
 */
export function LanguageSwitcher({
  variant = "header",
}: {
  variant?: "header" | "settings";
}) {
  const active = useLocale() as Locale;
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === active || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  const labels: Record<Locale, string> = {
    de: t("languageGerman"),
    en: t("languageEnglish"),
  };

  const control = (
    <div
      role="group"
      aria-label={t("language")}
      className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 p-0.5"
    >
      {LOCALES.map((loc) => {
        const isActive = loc === active;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => choose(loc)}
            disabled={pending}
            aria-pressed={isActive}
            aria-label={labels[loc]}
            className={`rounded px-2 py-1 text-caption font-medium uppercase tracking-wider transition-colors disabled:opacity-60 ${
              isActive
                ? "bg-card text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {loc}
          </button>
        );
      })}
    </div>
  );

  if (variant === "settings") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-card p-5">
        <div>
          <div className="text-body-strong text-neutral-900">
            {t("language")}
          </div>
          <p className="mt-1 text-small text-neutral-500">{labels[active]}</p>
        </div>
        {control}
      </div>
    );
  }

  return control;
}

export default LanguageSwitcher;

"use client";

import { useTranslations } from "next-intl";

import { useTheme, type ThemePreference } from "@/components/theme/ThemeShell";

const OPTIONS: ThemePreference[] = ["light", "system", "dark"];

function ThemeIcon({ option }: { option: ThemePreference }) {
  // 14px-Inline-Icons (Sonne / Monitor / Mond), Strichstil wie die übrige
  // Shell-Ikonografie; Farbe erbt via currentColor vom Button-Zustand.
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (option === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }
  if (option === "dark") {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8m-4-4v4" />
    </svg>
  );
}

/**
 * Hell/System/Dunkel-Umschalter fürs Dashboard. Spiegelt das Segmented-
 * Control-Pattern des LanguageSwitchers (header: kompakt neben dem
 * User-Menü, settings: beschriftete Zeile auf der Profil-Seite).
 */
export function ThemeSwitcher({
  variant = "header",
}: {
  variant?: "header" | "settings";
}) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("common");

  const labels: Record<ThemePreference, string> = {
    light: t("themeLight"),
    system: t("themeSystem"),
    dark: t("themeDark"),
  };

  const control = (
    <div
      role="group"
      aria-label={t("theme")}
      className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 p-0.5"
    >
      {OPTIONS.map((option) => {
        const isActive = option === theme;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setTheme(option)}
            aria-pressed={isActive}
            aria-label={labels[option]}
            title={labels[option]}
            className={`rounded px-2 py-1 transition-colors ${
              isActive
                ? "bg-card text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <ThemeIcon option={option} />
          </button>
        );
      })}
    </div>
  );

  if (variant === "settings") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-card p-5">
        <div>
          <div className="text-body-strong text-neutral-900">{t("theme")}</div>
          <p className="mt-1 text-small text-neutral-500">{labels[theme]}</p>
        </div>
        {control}
      </div>
    );
  }

  return control;
}

export default ThemeSwitcher;

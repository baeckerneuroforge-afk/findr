"use client";

import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";

/**
 * Header button that opens the Cmd+K palette. Styled as a slim faux-input
 * (icon + placeholder text + ⌘K hint) so the affordance reads as "search
 * field" at a glance, even though clicking it opens the modal palette
 * rather than focusing an inline input. Same pattern as Linear / Vercel /
 * Raycast.
 *
 * Width is fixed (≈ 14rem) so the centered grid column in the header
 * doesn't shift when sibling content changes. The kbd hint hides below
 * `sm:` to keep the button usable on narrow viewports.
 */

interface GlobalSearchTriggerProps {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-neutral-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" strokeLinecap="round" />
      <path d="m20 20-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

export function GlobalSearchTrigger({ onClick }: GlobalSearchTriggerProps) {
  const t = useTranslations("command");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("triggerAria")}
      className="flex h-9 w-[14rem] items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-small text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-700"
    >
      <SearchIcon />
      <span className="flex-1 text-left">{t("triggerPlaceholder")}</span>
      <kbd className="hidden items-center gap-0.5 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-caption font-medium text-neutral-500 sm:inline-flex">
        ⌘K
      </kbd>
    </button>
  );
}

"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";

import type { SearchIndex } from "@/lib/search/types";
import { PALETTE_ROUTES } from "@/lib/search/nav-routes";
import { ENABLED_MODULES } from "@/config/modules";

/**
 * The cmdk-based palette modal. Lazy-hydrates the org's deals + accounts
 * the first time it opens, then keeps that snapshot in memory for the rest
 * of the session — subsequent opens are instant and per-keystroke filtering
 * stays client-side. Matching is plain case-insensitive substring across
 * the item's `value` string (id + display fields concatenated).
 *
 * Why this lives in its own component instead of being inlined in the
 * widget: cmdk's Dialog wraps Radix Dialog (portal + focus trap + escape
 * handling), so it owns its DOM root — the trigger button and the dialog
 * portal are unrelated mount points, and pretending otherwise just makes
 * the wrapper file harder to read.
 */

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Store-Trio fürs Portal-Ziel (ThemeShell-Div): das Element wechselt nie
 *  nach Mount → leerer Subscribe; getElementById gibt eine stabile Referenz
 *  zurück (Snapshot-Identität hält über Renders). */
function subscribeNever(): () => void {
  return () => {};
}
function getThemeShellContainer(): HTMLElement | undefined {
  return document.getElementById("klymeo-theme-shell") ?? undefined;
}
function getServerContainer(): HTMLElement | undefined {
  return undefined;
}

/** Case-insensitive substring filter. Overrides cmdk's default fuzzy
 *  scoring per the v1 spec ("simpel substring"). Returns 1 = show, 0 = hide;
 *  cmdk uses the score to rank so equal scores fall back to render order
 *  (Deals → Accounts → Go to). */
function paletteFilter(value: string, search: string): number {
  if (!search) return 1;
  return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
}

function DealIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-neutral-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path strokeLinecap="round" d="M3 17l6-6 4 4 8-8" />
      <path strokeLinecap="round" d="M14 7h7v7" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-neutral-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path strokeLinecap="round" d="M3 21V7l9-4 9 4v14" />
      <path strokeLinecap="round" d="M9 21V11h6v10" />
    </svg>
  );
}

function StudyIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-neutral-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path strokeLinecap="round" d="M4 5h16M4 12h16M4 19h10" />
    </svg>
  );
}

/** Status-Label-Keys der Studien-Zeilen — bewusst eine geschlossene Map mit
 *  Raw-Fallback, damit ein unbekannter Status nie einen i18n-Throw auslöst. */
const STUDY_STATUS_KEY: Record<string, string> = {
  draft: "research.plans.status.draft",
  active: "research.plans.status.active",
  completed: "research.plans.status.completed",
  archived: "research.plans.status.archived",
};

function RouteIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-neutral-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path strokeLinecap="round" d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  // Root translator: this component pulls from both command.* (palette chrome)
  // and nav.* (the route labels/groups mirrored from the sidebar).
  const t = useTranslations();
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Portal-Ziel: das ThemeShell-Div (statt document.body), damit die
  // Palette die .dark-Variablen des Dashboards erbt. useSyncExternalStore
  // statt setState-in-Effect: SSR-Snapshot undefined (= cmdk-Default), im
  // Client liefert getElementById eine stabile Referenz — kein Re-Render-
  // Kaskadenrisiko, kein Hydration-Trap.
  const portalContainer = useSyncExternalStore(
    subscribeNever,
    getThemeShellContainer,
    getServerContainer,
  );

  // Lazy session-cache hydration. Fires on the FIRST open; closing then
  // re-opening reuses the in-memory snapshot. A page navigation does NOT
  // rebuild the index — the cache lives in this component's state, which
  // is preserved across route changes thanks to its mount point above the
  // <main> in the dashboard shell. A full page reload of course resets it.
  useEffect(() => {
    if (!open || index || loading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/search/index", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Search index unavailable (HTTP ${res.status})`);
        }
        return (await res.json()) as SearchIndex;
      })
      .then((data) => {
        if (!cancelled) setIndex(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, index, loading]);

  function go(href: string): void {
    onOpenChange(false);
    router.push(href);
  }

  const hasDeals =
    ENABLED_MODULES.salesIntelligence && (index?.deals.length ?? 0) > 0;
  const hasAccounts =
    ENABLED_MODULES.csHealth && (index?.accounts.length ?? 0) > 0;
  const hasStudies =
    ENABLED_MODULES.marketResearch && (index?.studies?.length ?? 0) > 0;
  const routeOnlySearch =
    !ENABLED_MODULES.salesIntelligence &&
    !ENABLED_MODULES.csHealth &&
    !ENABLED_MODULES.marketResearch;
  // MR-only-Setup (heutiger Zustand): der Placeholder nennt Studien statt
  // Deals/Accounts — sonst verspräche er Inhalte, die das Gating ausblendet.
  const studyOnlySearch =
    !ENABLED_MODULES.salesIntelligence &&
    !ENABLED_MODULES.csHealth &&
    ENABLED_MODULES.marketResearch;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={t("command.dialogLabel")}
      filter={paletteFilter}
      // Radix portalt den Dialog standardmäßig an document.body — das läge
      // AUSSERHALB des .dark-Wrappers (ThemeShell) und die Palette bliebe im
      // Dunkelmodus hell. Der Container verankert das Portal im Shell-Div.
      container={portalContainer}
      overlayClassName="fixed inset-0 z-40 bg-black/40"
      contentClassName="fixed left-1/2 top-[15vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-neutral-200 bg-card shadow-lg"
    >
      <Command.Input
        placeholder={
          routeOnlySearch
            ? t("command.inputPlaceholderPages")
            : studyOnlySearch
              ? t("command.inputPlaceholderStudies")
              : t("command.inputPlaceholder")
        }
        className="h-12 w-full border-b border-neutral-200 bg-transparent px-4 text-body text-neutral-900 outline-none placeholder:text-neutral-400"
      />
      <Command.List className="max-h-[60vh] overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-neutral-400">
        {loading && !index && (
          <Command.Loading>
            <div className="px-3 py-4 text-small text-neutral-500">
              {t("command.loading")}
            </div>
          </Command.Loading>
        )}

        {error && (
          <div className="px-3 py-4 text-small text-danger-700">
            {t("command.error", { error })}
          </div>
        )}

        <Command.Empty className="px-3 py-6 text-center text-small text-neutral-500">
          {t("command.empty")}
        </Command.Empty>

        {hasDeals && index && (
          <Command.Group heading={t("command.group.deals")}>
            {index.deals.map((deal) => (
              <Command.Item
                key={deal.id}
                // Include the id in the value to guarantee uniqueness across
                // items with identical display fields. UUID substrings make
                // for unlikely accidental matches on user input.
                value={`${deal.id} ${deal.name} ${deal.companyName} ${deal.stage}`}
                onSelect={() => go(`/dashboard/deals/${deal.id}`)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-body text-neutral-700 data-[selected=true]:bg-neutral-100 data-[selected=true]:text-neutral-900"
              >
                <DealIcon />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-neutral-900">
                    {deal.name}
                  </span>
                  {deal.companyName !== deal.name && (
                    <span className="text-neutral-500"> · {deal.companyName}</span>
                  )}
                </span>
                <span className="shrink-0 text-caption uppercase tracking-wider text-neutral-400">
                  {deal.stage}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {hasAccounts && index && (
          <Command.Group heading={t("command.group.accounts")}>
            {index.accounts.map((account) => (
              <Command.Item
                key={account.id}
                value={`${account.id} ${account.companyName} ${account.sponsorName ?? ""} ${account.status}`}
                onSelect={() => go(`/dashboard/accounts/${account.id}`)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-body text-neutral-700 data-[selected=true]:bg-neutral-100 data-[selected=true]:text-neutral-900"
              >
                <AccountIcon />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-neutral-900">
                    {account.companyName}
                  </span>
                  {account.sponsorName && (
                    <span className="text-neutral-500">
                      {" · "}
                      {account.sponsorName}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-caption uppercase tracking-wider text-neutral-400">
                  {account.status}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {hasStudies && index && (
          <Command.Group heading={t("command.group.studies")}>
            {index.studies.map((study) => (
              <Command.Item
                key={study.id}
                value={`${study.id} ${study.title} ${study.status}`}
                onSelect={() => go(`/dashboard/market-research/${study.id}`)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-body text-neutral-700 data-[selected=true]:bg-neutral-100 data-[selected=true]:text-neutral-900"
              >
                <StudyIcon />
                <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">
                  {study.title}
                </span>
                <span className="shrink-0 text-caption uppercase tracking-wider text-neutral-400">
                  {STUDY_STATUS_KEY[study.status]
                    ? t(STUDY_STATUS_KEY[study.status])
                    : study.status}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading={t("command.group.goTo")}>
          {PALETTE_ROUTES.map((route) => {
            const label = t(route.labelKey);
            const group = t(route.groupKey);
            return (
              <Command.Item
                key={route.href}
                value={`${route.href} ${label} ${group}`}
                onSelect={() => go(route.href)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-body text-neutral-700 data-[selected=true]:bg-neutral-100 data-[selected=true]:text-neutral-900"
              >
                <RouteIcon />
                <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">
                  {label}
                </span>
                <span className="shrink-0 text-caption uppercase tracking-wider text-neutral-400">
                  {group}
                </span>
              </Command.Item>
            );
          })}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

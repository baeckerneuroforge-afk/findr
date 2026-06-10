"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import type { EmergentTheme } from "@/lib/synthesis/service";

/**
 * Expandable card for a single emergent theme. Header shows title + summary
 * + frequency-of-total label. Click to expand and reveal verbatim quotes
 * (the auditability surface) plus the IDs of the source interviews this
 * theme was extracted from.
 *
 * The sourceInsightIds are rendered as opaque uuids for now; once an
 * insight-detail page exists they can become links. The IDs are still
 * useful today as a copy-paste handle when investigating a theme manually.
 */

interface SynthesisThemeCardProps {
  theme: EmergentTheme;
  /** based_on_count from the parent synthesis row — drives the
   *  "{frequency} of {total} participants" label. */
  totalParticipants: number;
  /** E7 (Konsole-v5): insightId → Transkript-Href. Optional und lückenhaft
   *  erlaubt — IDs ohne Eintrag rendern wie bisher ohne Link (ältere
   *  Interviews ohne session_id-Stempel). */
  sessionHrefById?: Record<string, string>;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${
        open ? "rotate-180" : ""
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
    </svg>
  );
}

export function SynthesisThemeCard({
  theme,
  totalParticipants,
  sessionHrefById,
}: SynthesisThemeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("research.synthesis");

  // Defensive client-side dedup: the engine already runs Array.from(new Set(...))
  // before persisting (engine.ts ~L318), so this is a no-op for fresh syntheses.
  // It exists for older persisted rows / DB-roundtrip edge cases — keeps the
  // displayed count and the rendered list consistent under any data shape.
  const uniqueSourceIds = Array.from(new Set(theme.sourceInsightIds));

  const frequencyLabel =
    totalParticipants > 0
      ? t("freqOfTotal", {
          frequency: theme.frequency,
          total: totalParticipants,
        })
      : t("freqMentions", { frequency: theme.frequency });

  return (
    <div
      className={`rounded-lg border bg-white transition-all ${
        expanded
          ? "border-primary-200"
          : "border-neutral-200 hover:border-neutral-300"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-start gap-4 px-5 py-4 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="text-h3 text-neutral-900">{theme.title}</div>
          <p className="mt-1 text-body text-neutral-600">{theme.summary}</p>
          <div className="mt-2 text-caption font-medium uppercase tracking-wider text-neutral-400">
            {frequencyLabel}
          </div>
          {/* Frequenz als Balken (Konsole-v5 E5) — macht „11 von 44“ auf einen
              Blick vergleichbar; nur sinnvoll, wenn es eine Gesamtzahl gibt. */}
          {totalParticipants > 0 && (
            <div className="mt-1.5 h-1.5 w-full max-w-60 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-primary-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((theme.frequency / totalParticipants) * 100),
                  )}%`,
                }}
              />
            </div>
          )}
        </div>
        <ChevronIcon open={expanded} />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-neutral-200 px-5 pb-5 pt-4">
          {theme.quotes.length > 0 && (
            <div>
              <div className="mb-2 text-caption font-medium uppercase tracking-wider text-neutral-500">
                {t("quotes", { count: theme.quotes.length })}
              </div>
              <ul className="space-y-2">
                {theme.quotes.map((q, i) => (
                  <li
                    key={i}
                    className="border-l-2 border-primary-200 pl-3 text-small italic text-neutral-600"
                  >
                    „{q}“
                  </li>
                ))}
              </ul>
            </div>
          )}

          {uniqueSourceIds.length > 0 && (
            <div>
              <div className="mb-2 text-caption font-medium uppercase tracking-wider text-neutral-500">
                {t("sourceInterviewsCard", { count: uniqueSourceIds.length })}
              </div>
              <ul className="space-y-1">
                {uniqueSourceIds.map((id, idx) => {
                  const href = sessionHrefById?.[id];
                  return (
                    <li
                      key={`${id}-${idx}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="font-mono text-caption text-neutral-500">
                        {id}
                      </span>
                      {href && (
                        <Link
                          href={href}
                          className="shrink-0 text-caption font-medium text-primary-700 transition-colors hover:text-primary-800"
                        >
                          {t("openInterview")}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {theme.quotes.length === 0 && uniqueSourceIds.length === 0 && (
            <p className="text-small italic text-neutral-500">
              {t("noQuotesOrSources")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

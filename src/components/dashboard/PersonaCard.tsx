"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import type {
  EnrichedAudiencePersona,
  PersonaEvidenceField,
} from "@/lib/schemas/synthesis";

/**
 * Expandable card for ONE audience persona (Spec
 * docs/klymeo-personas-feature-spec-2026-06-21.md). Gallery header shows a
 * monogram (no photos — Spec §0), the segment name, the honest share% (with a
 * bar), the server-derived role/segment labels and the lead quote. Expanded:
 * goals / pains / behavior / motivation, the sentiment distribution, and the
 * EVIDENCE chain — every backing quote with a clickable link to its source
 * interview (sessionHrefById, resolvable for market_research in v1).
 *
 * Mirrors SynthesisThemeCard's expand affordance. All persona numbers
 * (sharePercent, sentiment counts) are SERVER-computed (engine), never the LLM.
 */

interface PersonaCardProps {
  persona: EnrichedAudiencePersona;
  /** personas_summary.totalInsights — the share denominator. */
  total: number;
  /** insightId → interview-session href. Optional/lückenhaft: IDs ohne Eintrag
   *  rendern ohne Link (Interviews ohne session_id-Stempel). */
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

function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function PersonaCard({ persona, total, sessionHrefById }: PersonaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("research.personas");

  const fieldLabel: Record<PersonaEvidenceField, string> = {
    goal: t("fieldGoal"),
    pain: t("fieldPain"),
    behavior: t("fieldBehavior"),
    motivation: t("fieldMotivation"),
    lead_quote: t("fieldLeadQuote"),
  };

  const sentiment = persona.sentimentDistribution;
  const sentimentSegments: Array<{ key: string; n: number; color: string }> = [
    { key: t("sentimentPositive"), n: sentiment.positive, color: "bg-success-500" },
    { key: t("sentimentNeutral"), n: sentiment.neutral, color: "bg-neutral-300" },
    { key: t("sentimentNegative"), n: sentiment.negative, color: "bg-danger-500" },
    { key: t("sentimentMixed"), n: sentiment.mixed, color: "bg-warning-500" },
    { key: t("sentimentUnknown"), n: sentiment.unknown, color: "bg-neutral-200" },
  ];
  const sentimentTotal = sentimentSegments.reduce((s, x) => s + x.n, 0);

  return (
    <div
      className={`rounded-lg border bg-card transition-all ${
        expanded ? "border-primary-200" : "border-neutral-200 hover:border-neutral-300"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-start gap-4 px-5 py-4 text-left"
        aria-expanded={expanded}
      >
        <div
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-body-strong font-semibold text-primary-700"
        >
          {monogram(persona.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-h3 text-neutral-900">{persona.name}</span>
            <span className="text-body-strong text-neutral-900">
              {persona.sharePercent}%
            </span>
          </div>
          <div className="mt-1 text-caption font-medium uppercase tracking-wider text-neutral-400">
            {t("shareOfTotal", { count: persona.shareCount, total })}
          </div>
          {/* Anteils-Balken — die ehrliche, server-erzwungene Größe. */}
          <div className="mt-1.5 h-1.5 w-full max-w-60 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-primary-500"
              style={{ width: `${Math.min(100, persona.sharePercent)}%` }}
            />
          </div>
          {(persona.roleLabel || persona.segmentLabel) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {persona.roleLabel && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption text-neutral-600">
                  {persona.roleLabel}
                </span>
              )}
              {persona.segmentLabel && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption text-neutral-600">
                  {persona.segmentLabel}
                </span>
              )}
            </div>
          )}
          {persona.leadQuote && (
            <p className="mt-2 border-l-2 border-primary-200 pl-3 text-small italic text-neutral-600">
              „{persona.leadQuote}“
            </p>
          )}
        </div>
        <ChevronIcon open={expanded} />
      </button>

      {expanded && (
        <div className="space-y-5 border-t border-neutral-200 px-5 pb-5 pt-4">
          <TraitList title={t("goalsTitle")} items={persona.goals} />
          <TraitList title={t("painsTitle")} items={persona.pains} />
          <TraitList title={t("behaviorTitle")} items={persona.behavior} />

          {persona.motivation && (
            <div>
              <div className="mb-1 text-caption font-medium uppercase tracking-wider text-neutral-500">
                {t("motivationTitle")}
              </div>
              <p className="text-body leading-relaxed text-neutral-700">
                {persona.motivation}
              </p>
            </div>
          )}

          {/* Stimmungs-Verteilung — server-gezählt aus den echten Insight-Sentiments. */}
          {sentimentTotal > 0 && (
            <div>
              <div className="mb-1.5 text-caption font-medium uppercase tracking-wider text-neutral-500">
                {t("sentimentTitle")}
              </div>
              <div className="flex h-2 w-full max-w-60 overflow-hidden rounded-full bg-neutral-100">
                {sentimentSegments
                  .filter((s) => s.n > 0)
                  .map((s) => (
                    <div
                      key={s.key}
                      className={s.color}
                      style={{ width: `${(s.n / sentimentTotal) * 100}%` }}
                    />
                  ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-caption text-neutral-500">
                {sentimentSegments
                  .filter((s) => s.n > 0)
                  .map((s) => (
                    <span key={s.key}>
                      {s.key} {s.n}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Belegkette — jedes belegte Trait-Feld mit wörtlichem Zitat und
              klickbarem Quell-Interview (sessionHrefById, in v1 immer auflösbar). */}
          {persona.evidence.length > 0 && (
            <div>
              <div className="mb-2 text-caption font-medium uppercase tracking-wider text-neutral-500">
                {t("evidenceTitle")}
              </div>
              <ul className="space-y-3">
                {persona.evidence.map((ev, i) => (
                  <li key={i} className="border-l-2 border-primary-200 pl-3">
                    <p className="text-small italic text-neutral-600">
                      „{ev.text}“
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption text-neutral-500">
                        {fieldLabel[ev.field]}
                      </span>
                      {ev.sourceInsightIds.map((id, idx) => {
                        const href = sessionHrefById?.[id];
                        return href ? (
                          <Link
                            key={`${id}-${idx}`}
                            href={href}
                            className="text-caption font-medium text-primary-700 transition-colors hover:text-primary-800"
                          >
                            {t("openInterview")}
                          </Link>
                        ) : (
                          <span
                            key={`${id}-${idx}`}
                            className="font-mono text-caption text-neutral-400"
                          >
                            {id}
                          </span>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TraitList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1 text-caption font-medium uppercase tracking-wider text-neutral-500">
        {title}
      </div>
      <ul className="list-disc space-y-1 pl-5 text-body text-neutral-700">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

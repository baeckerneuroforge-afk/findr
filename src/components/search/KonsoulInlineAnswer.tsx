"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { KonsoulResult, PortfolioFacts } from "@/lib/schemas/konsoul-agent";
import { chipToneForKind } from "@/lib/konsoul/render-helpers";

/**
 * Konsoul P5 — COMPACT inline answer for the ⌘K palette. Renders a KonsoulResult
 * by `kind`, faithfully preserving the honesty grammar of the full
 * CrossStudyAgentPanel in a tighter footprint:
 *   - grounded      → answer prose + a green „belegt" chip + verbatim citations
 *                     linking to the cited study's synthesis (the ONLY green path).
 *   - interpretation→ answer prose + an amber „nicht direkt belegt" label + the
 *                     soft interpretation text.
 *   - guidance      → neutral answer prose, no chip, no citations.
 *   - refusal       → calm answer prose, never red.
 *   - proposal      → the rationale prose + a neutral hint to open the research
 *                     room (the P3 confirm flow is NOT replicated inline).
 * Numbers are never invented here — they ride in the answer/citations exactly as
 * the engine produced them; nothing is re-aggregated client-side.
 */

const MAX_QUOTE = 160;

function KindChip({ label, tone }: { label: string; tone: "grounded" | "soft" }) {
  return (
    <span
      className={
        tone === "grounded"
          ? "inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2 py-0.5 text-caption font-medium text-primary-700"
          : "inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-2 py-0.5 text-caption font-medium text-warning-700"
      }
    >
      <span
        className={
          tone === "grounded"
            ? "h-1.5 w-1.5 rounded-full bg-primary-500"
            : "h-1.5 w-1.5 rounded-full bg-warning-500"
        }
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function Citations({
  citations,
  openLabel,
}: {
  citations: { studyId: string; quote: string }[];
  openLabel: string;
}) {
  if (citations.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {citations.map((c, i) => (
        <li
          key={`${c.studyId}-${i}`}
          className="border-l-2 border-primary-200 pl-2.5 text-small text-neutral-600"
        >
          <span className="italic">
            {`„${
              c.quote.length > MAX_QUOTE
                ? `${c.quote.slice(0, MAX_QUOTE)}…`
                : c.quote
            }“`}
          </span>{" "}
          <Link
            href={`/dashboard/research-plans/${encodeURIComponent(c.studyId)}/synthesis`}
            className="font-medium text-primary-700 hover:underline"
          >
            {openLabel}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The deterministic facts block (PortfolioFacts) — the SAME honesty moat the
 *  full panel renders next to guidance/proposal prose. Numbers come from a tool
 *  read; the model can neither invent nor rewrite them. completedSessions===null
 *  (a read error) renders „—", NEVER 0. Capped for the compact surface. */
function DataFacts({ data }: { data: PortfolioFacts }) {
  const t = useTranslations("command");
  if (data.studies.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5 border-t border-neutral-100 pt-2">
      {data.studies.slice(0, 6).map((s) => (
        <li
          key={s.studyId}
          className="flex items-center justify-between gap-3 text-small text-neutral-600"
        >
          <span className="min-w-0 truncate">{s.title}</span>
          <span className="shrink-0 font-mono text-neutral-700">
            {s.completedSessions === null
              ? "—"
              : t("inlineFactInterviews", { count: s.completedSessions })}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function KonsoulInlineAnswer({ result }: { result: KonsoulResult }) {
  const t = useTranslations("command");
  const openCite = t("inlineCiteOpen");
  // Green ONLY for live grounded; amber for interpretation; none otherwise —
  // the same structural grammar the unit test freezes (render-helpers.ts).
  const tone = chipToneForKind(result.kind);

  return (
    <div className="space-y-1.5">
      {tone === "grounded" && (
        <KindChip label={t("inlineLabelGrounded")} tone="grounded" />
      )}
      {tone === "soft" && (
        <KindChip label={t("inlineLabelInterpretation")} tone="soft" />
      )}

      {/* Answer / rationale prose. Proposals carry `rationale` (UI-only, never
          persisted); every other kind carries `answer`. */}
      <p className="whitespace-pre-wrap text-body text-neutral-900">
        {result.kind === "proposal" ? result.rationale : result.answer}
      </p>

      {/* guidance/proposal carry the deterministic facts block — render it so
          inline keeps the SAME tool-grounded number source as the full panel
          (the model can't rewrite a count that's shown straight from `data`). */}
      {(result.kind === "guidance" || result.kind === "proposal") &&
        result.data && <DataFacts data={result.data} />}

      {(result.kind === "grounded" || result.kind === "interpretation") && (
        <Citations citations={result.citations} openLabel={openCite} />
      )}

      {result.kind === "interpretation" && (
        <p className="mt-1 rounded-md border border-dashed border-warning-500/40 bg-warning-50 px-2.5 py-1.5 text-small text-warning-700">
          {result.interpretation}
        </p>
      )}

      {result.kind === "proposal" && (
        <p className="mt-1 text-small text-neutral-500">
          {t("inlineProposalHint")}
        </p>
      )}
    </div>
  );
}

export default KonsoulInlineAnswer;

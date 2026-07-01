import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { toBcp47 } from "@/i18n/locale";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { MetaSynthesisCitation } from "@/lib/schemas/meta-synthesis";
import type { MetaSynthesisRecord } from "@/lib/meta-synthesis/service";

/**
 * Read-only render of a persisted meta-synthesis — the deep, high-quality
 * artifact (overview / cross-study themes / divergences / per-study contributions
 * / interpretation). Server component: resolves its own translations + locale.
 *
 * Every citation resolves its studyId → title via the artifact's OWN based_on
 * snapshot (so labels survive a source-study rename/delete) and links to that
 * study's synthesis page. Numbers come from the stored data, never re-derived.
 */

type StudyTitleResolver = (studyId: string) => string;

export async function MetaSynthesisView({
  record,
}: {
  record: MetaSynthesisRecord;
}) {
  const t = await getTranslations("metaSynthesis");
  const locale = await getLocale();
  const dateFmt = new Intl.DateTimeFormat(toBcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const titleByStudy = new Map(
    record.basedOn.map((s) => [s.studyId, s.studyTitle]),
  );
  const resolveTitle: StudyTitleResolver = (studyId) =>
    titleByStudy.get(studyId) ?? studyId;

  const totalStudies = record.basedOn.length;
  const totalInterviews = record.basedOn.reduce(
    (n, s) => n + s.basedOnCount,
    0,
  );

  const { result } = record;
  const openStudyHint = t("openStudyHint");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <Link
          href="/dashboard/insights/meta-synthesis"
          className="text-small font-medium text-primary-700 transition-colors hover:underline"
        >
          ← {t("backToList")}
        </Link>
        <div className="flex shrink-0 gap-2">
          <a
            href={`/api/meta-synthesis/${record.id}/pdf`}
            className="rounded-md border border-neutral-200 bg-card px-3 py-1.5 text-small font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            {t("exportPdf")}
          </a>
          <a
            href={`/api/meta-synthesis/${record.id}/pptx`}
            className="rounded-md border border-neutral-200 bg-card px-3 py-1.5 text-small font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            {t("exportPptx")}
          </a>
        </div>
      </div>

      <div>
        <h1 className="text-display text-neutral-900">{record.title}</h1>
        <p className="mt-1 text-small text-neutral-500">
          {t("subtitleLine", {
            studies: totalStudies,
            interviews: totalInterviews,
            date: dateFmt.format(new Date(record.createdAt)),
          })}
        </p>
      </div>

      {/* Compared studies — chips linking to each source synthesis. */}
      {record.basedOn.length > 0 && (
        <div className="space-y-2">
          <div className="text-caption font-medium uppercase tracking-wider text-neutral-500">
            {t("sourceStudies")}
          </div>
          <div className="flex flex-wrap gap-2">
            {record.basedOn.map((s) => (
              <Link
                key={s.studyId}
                href={`/dashboard/research-plans/${encodeURIComponent(
                  s.studyId,
                )}/synthesis`}
                title={openStudyHint}
                className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-card px-3 py-1 text-small text-neutral-700 transition-colors hover:border-primary-300 hover:bg-primary-50"
              >
                {s.studyTitle}
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Overview */}
      <Card>
        <CardHeader>
          <h2 className="text-h3 text-neutral-900">{t("overview")}</h2>
        </CardHeader>
        <CardBody>
          {result.overview.trim() !== "" ? (
            <p className="whitespace-pre-wrap text-body text-neutral-800">
              {result.overview}
            </p>
          ) : (
            <p className="text-body italic text-neutral-400">
              {t("overviewEmpty")}
            </p>
          )}
        </CardBody>
      </Card>

      {/* Convergent themes */}
      <section className="space-y-3">
        <h2 className="text-h3 text-neutral-900">{t("convergentThemes")}</h2>
        {result.convergent_themes.length === 0 ? (
          <p className="text-body italic text-neutral-400">
            {t("convergentEmpty")}
          </p>
        ) : (
          result.convergent_themes.map((theme, ti) => (
            <div
              key={ti}
              className="rounded-lg border border-neutral-200 bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-body font-medium text-neutral-900">
                  {theme.title}
                </h3>
                <span className="shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-caption font-medium text-primary-700">
                  {t("studyFrequency", {
                    count: theme.study_frequency,
                    total: totalStudies,
                  })}
                </span>
              </div>
              <p className="mt-1.5 text-small text-neutral-600">
                {theme.summary}
              </p>
              <CitationList
                citations={theme.citations}
                resolveTitle={resolveTitle}
                openStudyHint={openStudyHint}
              />
            </div>
          ))
        )}
      </section>

      {/* Divergences */}
      <section className="space-y-3">
        <h2 className="text-h3 text-neutral-900">{t("divergences")}</h2>
        {result.divergences.length === 0 ? (
          <p className="text-body italic text-neutral-400">
            {t("divergencesEmpty")}
          </p>
        ) : (
          result.divergences.map((divergence, di) => (
            <div
              key={di}
              className="rounded-lg border border-warning-500/40 bg-warning-50 p-4"
            >
              <p className="text-body font-medium text-warning-700">
                {divergence.description}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {divergence.positions.map((position, pi) => (
                  <div
                    key={pi}
                    className="rounded-md border border-neutral-200 bg-card p-3"
                  >
                    <p className="text-small font-medium text-neutral-900">
                      {position.label}
                    </p>
                    <p className="mt-0.5 text-caption text-neutral-400">
                      {position.studyIds
                        .map((id) => resolveTitle(id))
                        .join(" · ")}
                    </p>
                    <CitationList
                      citations={position.citations}
                      resolveTitle={resolveTitle}
                      openStudyHint={openStudyHint}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Per-study contributions (optional) */}
      {result.study_contributions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-h3 text-neutral-900">{t("contributions")}</h2>
          {result.study_contributions.map((contribution, ci) => (
            <div
              key={ci}
              className="rounded-lg border border-neutral-200 bg-card p-4"
            >
              <h3 className="text-body font-medium text-neutral-900">
                {resolveTitle(contribution.studyId)}
              </h3>
              <p className="mt-1.5 text-small text-neutral-600">
                {contribution.summary}
              </p>
              <CitationList
                citations={contribution.citations}
                resolveTitle={resolveTitle}
                openStudyHint={openStudyHint}
              />
            </div>
          ))}
        </section>
      )}

      {/* Interpretation — non-evidenced soft channel, visually distinct. */}
      {result.interpretation.trim() !== "" && (
        <div className="rounded-md border border-dashed border-warning-500/40 bg-warning-50 p-4">
          <div className="mb-1 text-caption font-medium uppercase tracking-wider text-warning-700">
            {t("interpretationTitle")}
          </div>
          <p className="whitespace-pre-wrap text-small italic text-neutral-600">
            {result.interpretation}
          </p>
        </div>
      )}

      <p className="text-caption text-neutral-400">{t("groundingNote")}</p>
    </div>
  );
}

/** Per-study citation rows: verbatim quote + a link to that study's synthesis. */
function CitationList({
  citations,
  resolveTitle,
  openStudyHint,
}: {
  citations: MetaSynthesisCitation[];
  resolveTitle: StudyTitleResolver;
  openStudyHint: string;
}) {
  if (citations.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2">
      {citations.map((citation, ci) => (
        <li
          key={ci}
          className="border-l-2 border-primary-200 pl-3 text-small"
        >
          <p className="italic text-neutral-700">„{citation.quote}“</p>
          <Link
            href={`/dashboard/research-plans/${encodeURIComponent(
              citation.studyId,
            )}/synthesis`}
            title={openStudyHint}
            className="mt-1 inline-flex items-center gap-1 text-caption font-medium text-primary-700 transition-colors hover:text-primary-800 hover:underline"
          >
            {resolveTitle(citation.studyId)}
            <span aria-hidden="true">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

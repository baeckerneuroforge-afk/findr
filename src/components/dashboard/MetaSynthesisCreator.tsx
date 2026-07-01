"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/**
 * Meta-Synthesis creator — the DEDICATED entry (André's "beides"): pick ≥2 studies
 * that have a synthesis, optionally add a focus, and generate a comparative
 * artifact. The Cross-Study chat CTA links here with the cited studies +
 * question PRE-SELECTED (via ?studies=…&focus=…, resolved server-side into
 * initialSelected / initialFocus), so both entry points converge on this one
 * component and the single POST /api/meta-synthesis route.
 *
 * On success we navigate to the persisted artifact's view page. Errors map the
 * route's stable `code` to a localized message (never the raw server string).
 */

interface StudyOption {
  studyId: string;
  studyTitle: string;
  basedOnCount: number;
}

interface MetaSynthesisCreatorProps {
  /** Org studies that HAVE a synthesis — the only valid inputs. */
  studies: StudyOption[];
  /** Pre-selected studyIds (from the chat CTA's cited studies). */
  initialSelected?: string[];
  /** Pre-filled focus (the chat question that triggered this). */
  initialFocus?: string;
}

export function MetaSynthesisCreator({
  studies,
  initialSelected,
  initialFocus,
}: MetaSynthesisCreatorProps) {
  const t = useTranslations("metaSynthesis");
  const router = useRouter();

  const validInitial = new Set(
    (initialSelected ?? []).filter((id) =>
      studies.some((s) => s.studyId === id),
    ),
  );
  const [selected, setSelected] = useState<Set<string>>(validInitial);
  const [focus, setFocus] = useState(initialFocus ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasStudies = studies.length > 0;
  const canSubmit = selected.size >= 2 && !loading;

  function toggle(studyId: string) {
    if (loading) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studyId)) next.delete(studyId);
      else next.add(studyId);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected.size < 2) {
      setError(t("minTwo"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/meta-synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyIds: [...selected],
          focus: focus.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        record?: { id: string };
        code?: string;
      };
      if (!res.ok || !data.success || !data.record) {
        setError(
          res.status === 401 || res.status === 403
            ? t("errNoAccess")
            : data.code === "not_enough_studies"
              ? t("errNotEnough")
              : t("errEngine"),
        );
        return;
      }
      router.push(`/dashboard/insights/meta-synthesis/${data.record.id}`);
    } catch (err) {
      setError(t("errNetwork"));
      console.error("meta-synthesis create failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-h3 text-neutral-900">{t("creatorTitle")}</h2>
        <p className="mt-1 text-small text-neutral-500">{t("creatorIntro")}</p>
      </CardHeader>
      <CardBody>
        {!hasStudies ? (
          <p className="text-body text-neutral-500">{t("noStudies")}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <div className="text-caption font-medium uppercase tracking-wider text-neutral-500">
                {t("selectStudies")}
              </div>
              <p className="text-small text-neutral-500">{t("selectHint")}</p>
              <ul className="mt-2 space-y-1.5">
                {studies.map((study) => {
                  const checked = selected.has(study.studyId);
                  return (
                    <li key={study.studyId}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                          checked
                            ? "border-primary-300 bg-primary-50/50"
                            : "border-neutral-200 bg-card hover:border-neutral-300 hover:bg-neutral-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(study.studyId)}
                          disabled={loading}
                          className="h-4 w-4 shrink-0 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body text-neutral-900">
                            {study.studyTitle}
                          </span>
                          <span className="block text-caption text-neutral-400">
                            {t("interviews", { count: study.basedOnCount })}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="meta-focus"
                className="block text-caption font-medium uppercase tracking-wider text-neutral-500"
              >
                {t("focusLabel")}
              </label>
              <input
                id="meta-focus"
                type="text"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder={t("focusPlaceholder")}
                disabled={loading}
                maxLength={2000}
                className="block w-full rounded-md border border-neutral-200 bg-card px-3 py-2 text-body text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              {error ? (
                <span className="max-w-md text-caption text-danger-700">
                  {error}
                </span>
              ) : (
                <span aria-hidden="true" />
              )}
              <button
                type="submit"
                disabled={!canSubmit}
                className="shrink-0 rounded-md border border-primary-600 bg-primary-600 px-4 py-2 text-small font-medium text-white transition-colors hover:border-primary-hover hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? t("submitting") : t("submit")}
              </button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

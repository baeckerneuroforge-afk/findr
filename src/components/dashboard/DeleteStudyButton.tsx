"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";

/**
 * "Studie löschen" — permanent, irreversible removal of a whole study via
 * DELETE /api/research/plans/[id]. The server gate (no interview sessions) is
 * the source of truth; this button is only rendered by the detail page when the
 * study qualifies, but the route re-checks regardless.
 *
 * UX mirrors DeleteParticipantButton: a native window.confirm carrying the
 * study title (destructive copy in one place, no design-system dependency),
 * inline error below the button (no silent failure on a destructive action).
 * On success the detail page is gone, so we navigate to the area's list instead
 * of router.refresh().
 *
 * `hasInterviews` switches the confirm to the stronger variant that spells out
 * that interviews + transcripts will ALSO be permanently deleted — this branch
 * is only reachable for an archived (closed) study, the deliberate second step.
 */
interface DeleteStudyButtonProps {
  planId: string;
  studyType: "market_research" | "product_discovery";
  /** Shown in the confirm dialog so the user sees what they're deleting. */
  title: string;
  /** True when the study already has interview sessions → stronger warning. */
  hasInterviews?: boolean;
  disabled?: boolean;
}

export function DeleteStudyButton({
  planId,
  studyType,
  title,
  hasInterviews = false,
  disabled = false,
}: DeleteStudyButtonProps) {
  const router = useRouter();
  const t = useTranslations("research.plans");
  const tc = useTranslations("research.common");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listHref =
    studyType === "market_research"
      ? "/dashboard/market-research"
      : "/dashboard/research-plans";

  async function runDelete() {
    const message = hasInterviews
      ? t("deleteStudyConfirmWithData", { title })
      : t("deleteStudyConfirm", { title });
    const ok = window.confirm(message);
    if (!ok) return;

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/research/plans/${planId}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? t("errDeleteStudy"));
      }
      // The study (and this page) no longer exist — go to the area's list.
      router.push(listHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errDeleteStudy"));
      setSubmitting(false);
    }
    // No setSubmitting(false) on success — we navigate away.
  }

  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        onClick={runDelete}
        disabled={disabled || submitting}
        className="text-danger-700 hover:bg-danger-50"
      >
        {submitting ? tc("deleting") : t("deleteStudyCta")}
      </Button>
      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}
    </div>
  );
}

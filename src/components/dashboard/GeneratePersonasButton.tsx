"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/ui/Toast";

/**
 * Trigger button for creating / re-running the Persona stage. Mirrors
 * UpdateSynthesisButton: posts to /api/research/plans/[id]/personas and
 * refreshes on success. The route returns a DOMAIN envelope ({ success,
 * result: { status, count } }) — only `generated` toasts + refreshes; the
 * other domain states surface inline (the button is normally gated below the
 * min-interview threshold, so these are defensive).
 */

interface GeneratePersonasButtonProps {
  planId: string;
  hasExisting: boolean;
  /** Min-Gate: unterhalb der Schwelle ist der Button deaktiviert (die Seite
   *  zeigt den Hinweis). */
  disabled?: boolean;
  /** Schwelle für die statusInsufficient-Meldung (Server ist die Wahrheit). */
  minInterviews: number;
}

export function GeneratePersonasButton({
  planId,
  hasExisting,
  disabled = false,
  minInterviews,
}: GeneratePersonasButtonProps) {
  const router = useRouter();
  const t = useTranslations("research.personas");
  const tc = useTranslations("research.common");
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(planId)}/personas`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        result?: { status?: string; count?: number };
      };
      if (!res.ok) {
        const message =
          res.status === 404
            ? tc("errPlanNotFound")
            : res.status === 401 || res.status === 403
              ? tc("errNoAccessPlan")
              : (data.error ?? t("errGenerate"));
        setError(message);
        console.error(
          `Persona generation failed for plan ${planId}:`,
          data.error ?? res.status,
        );
        return;
      }
      const status = data.result?.status;
      if (status === "generated") {
        toast(t("updatedToast"));
        router.refresh();
        return;
      }
      // Domain-Nicht-Erfolg (Button ist normal gated → defensiv):
      if (status === "insufficient_data") {
        setError(
          t("statusInsufficient", {
            min: minInterviews,
            count: data.result?.count ?? 0,
          }),
        );
      } else if (status === "no_insights") {
        setError(t("statusNoInsights"));
      } else if (status === "wrong_study_type") {
        setError(t("statusWrongType"));
      } else {
        setError(t("errGenerate"));
      }
    } catch (err) {
      setError(t("errGenerateNetwork"));
      console.error(`Persona generation failed for plan ${planId}:`, err);
    } finally {
      setLoading(false);
    }
  }

  const label = loading
    ? t("generating")
    : hasExisting
      ? t("regenerate")
      : t("generate");

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || disabled}
        className="inline-flex items-center gap-2 rounded-md border border-primary-600 bg-primary-600 px-4 py-2 text-small font-medium text-white transition-colors hover:border-primary-hover hover:bg-primary-hover disabled:opacity-50"
      >
        {loading && (
          <span
            aria-hidden="true"
            className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
          />
        )}
        {label}
      </button>
      {error && (
        <span className="max-w-72 text-right text-caption text-danger-700">
          {error}
        </span>
      )}
    </div>
  );
}

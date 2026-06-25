"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Trigger Product Discovery extraction on a single call. Mirrors
 * src/components/dashboard/AnalyzeButton.tsx (the Risk trigger): identical
 * states (idle / analysing / re-analyse), inline error rendering, and
 * router.refresh() after success so any nearby insight panel re-fetches.
 *
 * Difference vs the Risk button: this component shows a short result line
 * with the finding counts (Wünsche / Pains / Themen). The empty result is
 * itself a legitimate signal — the prompt's DO-NOT-DETECT rules make 0/0/0
 * the correct answer for calls with no product feedback in them — so we
 * surface that explicitly rather than treating it as a silent no-op.
 */

interface AnalyzeProductDiscoveryButtonProps {
  callId: string;
  /** Whether an insight already exists for this call — switches the label to
   *  "Erneut auf Produktsignale analysieren". */
  hasInsights: boolean;
}

interface InsightCounts {
  featureRequests: number;
  painPoints: number;
  themes: number;
}

interface PostResponse {
  success?: boolean;
  insight?: {
    feature_requests?: unknown[];
    pain_points?: unknown[];
    themes?: unknown[];
  };
  error?: string;
  detail?: string;
}

function arrayLen(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function AnalyzeProductDiscoveryButton({
  callId,
  hasInsights,
}: AnalyzeProductDiscoveryButtonProps) {
  const router = useRouter();
  const t = useTranslations("research.discovery");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<InsightCounts | null>(null);

  async function handleAnalyze(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    e.preventDefault();
    setAnalyzing(true);
    setError(null);
    setLastResult(null);

    try {
      const res = await fetch(
        `/api/calls/${encodeURIComponent(callId)}/product-discovery`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as PostResponse;

      if (!res.ok) {
        const message =
          res.status === 422
            ? t("errNoTranscript")
            : res.status === 404
              ? t("errCallNotFound")
              : res.status === 401 || res.status === 403
                ? t("errNoAccessCall")
                : (data.error ?? t("errAnalyze"));
        setError(message);
        console.error(
          `Product discovery failed for ${callId}:`,
          data.error ?? res.status,
        );
        return;
      }

      const insight = data.insight ?? {};
      setLastResult({
        featureRequests: arrayLen(insight.feature_requests),
        painPoints: arrayLen(insight.pain_points),
        themes: arrayLen(insight.themes),
      });
      router.refresh();
    } catch (err) {
      setError(t("errAnalyze"));
      console.error(`Product discovery failed for ${callId}:`, err);
    } finally {
      setAnalyzing(false);
    }
  }

  const label = analyzing
    ? t("analyzing")
    : hasInsights
      ? t("reanalyze")
      : t("analyze");

  const resultLine = lastResult
    ? lastResult.featureRequests === 0 &&
      lastResult.painPoints === 0 &&
      lastResult.themes === 0
      ? t("btnNoSignals")
      : t("resultCounts", {
          fr: lastResult.featureRequests,
          pp: lastResult.painPoints,
          themes: lastResult.themes,
        })
    : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={analyzing}
        className="text-caption font-medium text-primary-700 hover:underline disabled:opacity-50 transition-colors"
      >
        {label}
      </button>
      {resultLine && !error && (
        <span className="max-w-56 text-right text-caption text-neutral-700">
          {resultLine}
        </span>
      )}
      {error && (
        <span className="max-w-56 text-right text-caption text-danger-700">
          {error}
        </span>
      )}
    </div>
  );
}

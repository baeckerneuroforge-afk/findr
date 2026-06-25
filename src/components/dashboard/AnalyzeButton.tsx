"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface AnalyzeButtonProps {
  dealId: string;
  hasScore: boolean;
}

export function AnalyzeButton({ dealId, hasScore }: AnalyzeButtonProps) {
  const t = useTranslations("sales.table");
  const tc = useTranslations("sales.common");
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    e.preventDefault();
    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (res.status === 503) {
          setError(tc("analyzeUnavailable"));
        }
        console.error(`Analyze failed for ${dealId}:`, data.error ?? res.status);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(tc("analyzeFailed"));
      console.error(`Analyze failed for ${dealId}:`, err);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={analyzing}
        className="text-caption font-medium text-primary-700 hover:underline disabled:opacity-50 transition-colors"
      >
        {analyzing
          ? t("analyzingShort")
          : hasScore
            ? t("reanalyze")
            : t("analyze")}
      </button>
      {error && (
        <span className="max-w-44 text-right text-caption text-danger-700">
          {error}
        </span>
      )}
    </div>
  );
}

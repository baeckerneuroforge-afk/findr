"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

interface AnalyzeButtonProps {
  dealId: string;
  hasScore: boolean;
}

export function AnalyzeButton({ dealId, hasScore }: AnalyzeButtonProps) {
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
          setError(
            "AI analysis is not available right now. The team is working on it.",
          );
        }
        console.error(`Analyze failed for ${dealId}:`, data.error ?? res.status);
        return;
      }
      router.refresh();
    } catch (err) {
      setError("AI analysis failed. Please try again later.");
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
        className="text-caption font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50 transition-colors"
      >
        {analyzing ? "Analyzing…" : hasScore ? "Re-analyze" : "Analyze"}
      </button>
      {error && (
        <span className="max-w-44 text-right text-caption text-danger-700">
          {error}
        </span>
      )}
    </div>
  );
}

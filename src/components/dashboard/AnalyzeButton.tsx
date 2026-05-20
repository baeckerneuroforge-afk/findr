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

  async function handleAnalyze(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    e.preventDefault();
    setAnalyzing(true);

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
        console.error(`Analyze failed for ${dealId}:`, data.error ?? res.status);
      }
      router.refresh();
    } catch (err) {
      console.error(`Analyze failed for ${dealId}:`, err);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleAnalyze}
      disabled={analyzing}
      className="text-caption font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50 transition-colors"
    >
      {analyzing ? "Analyzing…" : hasScore ? "Re-analyze" : "Analyze"}
    </button>
  );
}

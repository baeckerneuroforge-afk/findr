"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface DealMinimal {
  id: string;
  name: string;
}

interface AnalyzeAllButtonProps {
  deals: DealMinimal[];
}

export function AnalyzeAllButton({ deals }: AnalyzeAllButtonProps) {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyzeAll() {
    if (deals.length === 0) return;
    setAnalyzing(true);
    setError(null);
    setProgress({ done: 0, total: deals.length });
    let completedAny = false;

    for (const deal of deals) {
      try {
        const response = await fetch("/api/risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dealId: deal.id }),
        });
        if (!response.ok) {
          if (response.status === 503) {
            setError(
              "AI analysis is not available right now. The team is working on it.",
            );
            break;
          }
          const data = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          console.error(
            `Analyze failed for ${deal.name}:`,
            data.error ?? response.status,
          );
        } else {
          completedAny = true;
        }
      } catch (err) {
        setError("AI analysis failed. Please try again later.");
        console.error(`Analyze failed for ${deal.name}:`, err);
        break;
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setAnalyzing(false);
    if (completedAny) router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="primary"
        onClick={handleAnalyzeAll}
        disabled={analyzing || deals.length === 0}
      >
        {analyzing
          ? `Analyzing ${progress.done}/${progress.total}…`
          : "Analyze all deals"}
      </Button>
      {error && (
        <span className="max-w-72 text-right text-caption text-danger-700">
          {error}
        </span>
      )}
    </div>
  );
}

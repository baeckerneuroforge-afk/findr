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

  async function handleAnalyzeAll() {
    if (deals.length === 0) return;
    setAnalyzing(true);
    setProgress({ done: 0, total: deals.length });

    for (const deal of deals) {
      try {
        await fetch("/api/risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dealId: deal.id }),
        });
      } catch (err) {
        console.error(`Analyze failed for ${deal.name}:`, err);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setAnalyzing(false);
    router.refresh();
  }

  return (
    <Button
      variant="primary"
      onClick={handleAnalyzeAll}
      disabled={analyzing || deals.length === 0}
    >
      {analyzing
        ? `Analyzing ${progress.done}/${progress.total}…`
        : "Analyze all deals"}
    </Button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { DealOutcome } from "@/lib/deals/types";

const META: Record<
  DealOutcome,
  { labelKey: "outcomeOpen" | "outcomeWon" | "outcomeLost"; variant: BadgeVariant }
> = {
  open: { labelKey: "outcomeOpen", variant: "default" },
  won: { labelKey: "outcomeWon", variant: "success" },
  lost: { labelKey: "outcomeLost", variant: "critical" },
};

interface DealOutcomeControlProps {
  dealId: string;
  initialOutcome: DealOutcome;
}

export function DealOutcomeControl({
  dealId,
  initialOutcome,
}: DealOutcomeControlProps) {
  const tr = useTranslations("sales.deal");
  const router = useRouter();
  const [outcome, setOutcome] = useState<DealOutcome>(initialOutcome);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function setTo(next: DealOutcome) {
    if (next === outcome || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/outcome`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? tr("errOutcome"));
      setOutcome(next);
      // Re-render the server component so the Post-Loss Interview section
      // appears/disappears for the new outcome.
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("errOutcome"));
    } finally {
      setBusy(false);
    }
  }

  // Offer transitions to the two states the deal is NOT currently in.
  const transitions: DealOutcome[] =
    outcome === "open"
      ? ["won", "lost"]
      : outcome === "won"
        ? ["lost", "open"]
        : ["won", "open"];

  const meta = META[outcome];

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge variant={meta.variant}>{tr(meta.labelKey)}</Badge>
      {transitions.map((next) => (
        <Button
          key={next}
          size="sm"
          variant={next === "lost" ? "danger" : "secondary"}
          onClick={() => setTo(next)}
          disabled={busy || pending}
        >
          {next === "open"
            ? tr("reopen")
            : next === "won"
              ? tr("markAsWon")
              : tr("markAsLost")}
        </Button>
      ))}
      {error && <span className="text-small text-danger-700">{error}</span>}
    </span>
  );
}

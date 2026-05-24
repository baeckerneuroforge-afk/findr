"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { DealOutcome } from "@/lib/deals/types";

const META: Record<DealOutcome, { label: string; variant: BadgeVariant }> = {
  open: { label: "Open", variant: "default" },
  won: { label: "Won", variant: "success" },
  lost: { label: "Lost", variant: "critical" },
};

interface DealOutcomeControlProps {
  dealId: string;
  initialOutcome: DealOutcome;
}

export function DealOutcomeControl({
  dealId,
  initialOutcome,
}: DealOutcomeControlProps) {
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
      if (!res.ok) throw new Error(data.error ?? "Could not update outcome.");
      setOutcome(next);
      // Re-render the server component so the Post-Loss Interview section
      // appears/disappears for the new outcome.
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update outcome.");
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
      <Badge variant={meta.variant}>{meta.label}</Badge>
      {transitions.map((t) => (
        <Button
          key={t}
          size="sm"
          variant={t === "lost" ? "danger" : "secondary"}
          onClick={() => setTo(t)}
          disabled={busy || pending}
        >
          {t === "open" ? "Reopen" : `Mark as ${t}`}
        </Button>
      ))}
      {error && <span className="text-small text-danger-700">{error}</span>}
    </span>
  );
}

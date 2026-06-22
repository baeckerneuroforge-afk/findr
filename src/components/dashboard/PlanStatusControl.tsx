"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

/**
 * Status-lifecycle buttons for a research plan.
 *
 * Transitions offered (UI policy, not DB-enforced — the column CHECK is the
 * backstop):
 *   draft     -> active     [Activate]
 *   active    -> completed  [Mark complete]
 *   any       -> archived   [Archive]  (except 'archived' itself)
 *   archived  -> draft      [Reactivate]
 *
 * Reactivation deliberately lands back on 'draft' (the editable, pre-launch
 * state) rather than 'active' — an archived study returns to the same place a
 * fresh study starts, so the researcher can edit it and start it again
 * intentionally. The other reverse transitions (e.g. completed -> active) stay
 * out of the UI as a light versehensschutz; flip them via the PATCH API if
 * truly needed.
 */

type Status = "draft" | "active" | "completed" | "archived";

interface PlanStatusControlProps {
  planId: string;
  status: Status;
}

export function PlanStatusControl({ planId, status }: PlanStatusControlProps) {
  const router = useRouter();
  const t = useTranslations("research.plans");
  const [pending, setPending] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: Status) {
    setPending(next);
    setError(null);
    try {
      const res = await fetch(`/api/research/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? t("errChangeStatus"));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errChangeStatus"));
    } finally {
      setPending(null);
    }
  }

  // Status-specific transitions. Each entry is [nextStatus, buttonVariant].
  const transitions: Array<{
    next: Status;
    label: string;
    variant: "primary" | "secondary" | "ghost" | "danger";
  }> = [];

  if (status === "draft") {
    transitions.push({
      next: "active",
      label: t("actActivate"),
      variant: "primary",
    });
  }
  if (status === "active") {
    transitions.push({
      next: "completed",
      label: t("actMarkComplete"),
      variant: "primary",
    });
  }
  if (status !== "archived") {
    transitions.push({
      next: "archived",
      label: t("actArchive"),
      variant: status === "draft" ? "ghost" : "secondary",
    });
  }
  // Reverse path out of the dead end: an archived study can be reactivated back
  // to 'draft' so it becomes editable + startable again. Lands on draft (not
  // active) so re-launch is a deliberate second step.
  if (status === "archived") {
    transitions.push({
      next: "draft",
      label: t("actReactivate"),
      variant: "primary",
    });
  }

  if (transitions.length === 0) {
    return (
      <p className="text-small text-neutral-500">{t("noActions")}</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {transitions.map((tr) => (
          <Button
            key={tr.next}
            variant={tr.variant}
            disabled={pending !== null}
            onClick={() => setStatus(tr.next)}
          >
            {pending === tr.next ? t("statusSaving") : tr.label}
          </Button>
        ))}
      </div>
      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}
    </div>
  );
}

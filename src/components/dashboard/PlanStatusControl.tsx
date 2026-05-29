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
 *
 * Reverse transitions (e.g. archived -> active) are intentionally NOT
 * offered in v1 — half a versehensschutz layer; you can flip them via the
 * PATCH API directly if needed.
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

"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/ui/Toast";

/**
 * Trigger button for re-running / creating the Stage-2 study synthesis.
 * Posts to /api/research/plans/[id]/synthesis and refreshes the page on
 * success so the new emergent_themes / tensions / overview show up.
 *
 * Label switches by whether a synthesis already exists, so the same button
 * reads as "Create" on first use and "Re-run" thereafter. Errors are
 * rendered inline beneath the button — keeps the page server-rendered
 * around it.
 */

interface UpdateSynthesisButtonProps {
  planId: string;
  hasExisting: boolean;
  /** A finished (synthesized_at set) synthesis exists → the post-hoc
   *  "Ausführlicher machen" button is offered. */
  synthesisReady?: boolean;
  /** Current stored detail level — hides the post-hoc button once ausführlich. */
  currentDetailLevel?: string;
}

export function UpdateSynthesisButton({
  planId,
  hasExisting,
  synthesisReady = false,
  currentDetailLevel = "standard",
}: UpdateSynthesisButtonProps) {
  const router = useRouter();
  const t = useTranslations("research.synthesis");
  const tc = useTranslations("research.common");
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [ausfuehrlich, setAusfuehrlich] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(planId)}/synthesis`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            detailLevel: ausfuehrlich ? "ausführlich" : "standard",
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        const message =
          res.status === 404
            ? tc("errPlanNotFound")
            : res.status === 401 || res.status === 403
              ? tc("errNoAccessPlan")
              : (data.detail ?? data.error ?? t("errSynthesis"));
        setError(message);
        console.error(
          `Synthesis update failed for plan ${planId}:`,
          data.detail ?? data.error ?? res.status,
        );
        return;
      }
      // Async-Muster (Konsole-v5 E5): Erfolg wird global bestätigt — die
      // Seite refresht still, der Toast sagt, DASS sich etwas getan hat.
      toast(t("updatedToast"));
      router.refresh();
    } catch (err) {
      setError(t("errSynthesisNetwork"));
      console.error(`Synthesis update failed for plan ${planId}:`, err);
    } finally {
      setLoading(false);
    }
  }

  // Post-hoc "Ausführlicher machen" — runs ONLY the additive narrative stage on
  // the existing synthesis (never re-synthesizes the core).
  async function handleExpand() {
    setExpanding(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(planId)}/synthesis/expand`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const message =
          res.status === 404
            ? tc("errPlanNotFound")
            : res.status === 401 || res.status === 403
              ? tc("errNoAccessPlan")
              : (data.error ?? t("errSynthesis"));
        setError(message);
        return;
      }
      toast(t("expandedToast"));
      router.refresh();
    } catch (err) {
      setError(t("errSynthesisNetwork"));
      console.error(`Synthesis expand failed for plan ${planId}:`, err);
    } finally {
      setExpanding(false);
    }
  }

  const label = loading
    ? t("synthesizing")
    : hasExisting
      ? t("updateSynthesis")
      : t("createSynthesis");

  const busy = loading || expanding;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        {/* Detailgrad — wirkt auf den Haupt-Button (Umschalter bei Generierung). */}
        <label className="flex cursor-pointer items-center gap-1.5 text-caption text-neutral-600">
          <input
            type="checkbox"
            checked={ausfuehrlich}
            onChange={(e) => setAusfuehrlich(e.target.checked)}
            disabled={busy}
            className="h-3.5 w-3.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          {t("detailAusfuehrlich")}
        </label>
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border border-primary-600 bg-primary-600 px-4 py-2 text-small font-medium text-white transition-colors hover:border-primary-hover hover:bg-primary-hover disabled:opacity-50"
        >
          {loading && (
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
            />
          )}
          {label}
        </button>
      </div>

      {/* Post-hoc: nur wenn eine fertige, noch NICHT ausführliche Synthese steht. */}
      {synthesisReady && currentDetailLevel !== "ausführlich" && (
        <button
          type="button"
          onClick={handleExpand}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-card px-3 py-1.5 text-caption font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
        >
          {expanding && (
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 motion-reduce:animate-none"
            />
          )}
          {expanding ? t("expanding") : t("makeAusfuehrlich")}
        </button>
      )}

      {error && (
        <span className="max-w-72 text-right text-caption text-danger-700">
          {error}
        </span>
      )}
    </div>
  );
}

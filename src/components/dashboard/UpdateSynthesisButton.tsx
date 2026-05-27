"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

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
}

export function UpdateSynthesisButton({
  planId,
  hasExisting,
}: UpdateSynthesisButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(planId)}/synthesis`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        const message =
          res.status === 404
            ? "Plan nicht gefunden."
            : res.status === 401 || res.status === 403
              ? "Kein Zugriff auf diesen Plan."
              : (data.detail ?? data.error ?? "Synthese fehlgeschlagen.");
        setError(message);
        console.error(
          `Synthesis update failed for plan ${planId}:`,
          data.detail ?? data.error ?? res.status,
        );
        return;
      }
      router.refresh();
    } catch (err) {
      setError("Synthese fehlgeschlagen — Netzwerkfehler.");
      console.error(`Synthesis update failed for plan ${planId}:`, err);
    } finally {
      setLoading(false);
    }
  }

  const label = loading
    ? "Wird synthetisiert…"
    : hasExisting
      ? "Synthese aktualisieren"
      : "Synthese erstellen";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-md border border-primary-600 bg-primary-600 px-4 py-2 text-small font-medium text-white transition-colors hover:border-primary-700 hover:bg-primary-700 disabled:opacity-50"
      >
        {label}
      </button>
      {error && (
        <span className="max-w-72 text-right text-caption text-danger-700">
          {error}
        </span>
      )}
    </div>
  );
}

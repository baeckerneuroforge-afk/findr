"use client";

import { useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";

/**
 * "Als PowerPoint exportieren" — downloads the Stage-2 synthesis as a Findr-
 * branded .pptx deck. Sibling to ExportSynthesisPdfButton; sits next to it in
 * the Synthese-Header with the same styling and the same ready-state gating
 * (the parent only renders it once a populated synthesis exists). ADDITIVE —
 * uses the SAME synthesis data path as the PDF export, just a different route.
 *
 * Download mechanic mirrors the PDF button: fetch the route so server errors
 * (404 "no synthesis", 401/403, 500) surface inline rather than dropping the
 * user on a raw JSON page.
 */

interface ExportSynthesisPptxButtonProps {
  planId: string;
  /** Set to true while the surrounding context can't legitimately produce a
   *  deck (no synthesis row yet). Keeps the button rendered for layout
   *  stability but unclickable. */
  disabled?: boolean;
}

export function ExportSynthesisPptxButton({
  planId,
  disabled = false,
}: ExportSynthesisPptxButtonProps) {
  const t = useTranslations("research.synthesis");
  const tc = useTranslations("research.common");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(planId)}/synthesis/pptx`,
        { method: "GET" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        const message =
          res.status === 404
            ? (data.error ?? t("errNoSynthesis"))
            : res.status === 401 || res.status === 403
              ? tc("errNoAccessPlan")
              : (data.detail ?? data.error ?? t("errPptx"));
        setError(message);
        console.error(
          `Synthesis PPTX download failed for plan ${planId}:`,
          data.detail ?? data.error ?? res.status,
        );
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().split("T")[0];
      const a = document.createElement("a");
      a.href = url;
      a.download = `findr-synthesis-${date}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(t("errPptxNetwork"));
      console.error(`Synthesis PPTX download failed for plan ${planId}:`, err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className="rounded-md border border-neutral-200 bg-card px-4 py-2 text-small font-medium text-neutral-900 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
      >
        {loading ? t("pptxExporting") : t("pptxExport")}
      </button>
      {error && (
        <span className="max-w-72 text-right text-caption text-danger-700">
          {error}
        </span>
      )}
    </div>
  );
}

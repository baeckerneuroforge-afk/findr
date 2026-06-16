"use client";

import { useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";

/**
 * "Als PDF exportieren" — downloads the Stage-2 synthesis as a Klymeo-
 * branded PDF. Sibling to UpdateSynthesisButton; sits next to it in the
 * Synthese-Header. ADDITIVE — does not change any existing behaviour.
 *
 * Renders ONLY when the page already has a populated synthesis (the parent
 * passes `disabled=false` only in that case). The API still 404s on a
 * missing synthesis, so the button can't generate a broken PDF even if
 * the parent's gating logic ever diverged.
 *
 * Download mechanic mirrors the existing /api/forecast/pdf path used by
 * the forecast page's "Download PDF" anchor — there it's an <a download>;
 * here we go via fetch because we want to surface a server-error message
 * (e.g. font load failure or "no synthesis yet") inline rather than land
 * on a JSON error page in a new tab.
 */

interface ExportSynthesisPdfButtonProps {
  planId: string;
  /** Set to true while the surrounding context can't legitimately produce
   *  a PDF (no synthesis row yet, or synthesized_at is null). Keeps the
   *  button rendered for layout stability but unclickable. */
  disabled?: boolean;
}

export function ExportSynthesisPdfButton({
  planId,
  disabled = false,
}: ExportSynthesisPdfButtonProps) {
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
        `/api/research/plans/${encodeURIComponent(planId)}/synthesis/pdf`,
        { method: "GET" },
      );
      if (!res.ok) {
        // The route surfaces JSON errors (401/403/404/500). Parse what we
        // can and render inline — better than dropping the user on a raw
        // JSON page in a new tab.
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        const message =
          res.status === 404
            ? (data.error ?? t("errNoSynthesis"))
            : res.status === 401 || res.status === 403
              ? tc("errNoAccessPlan")
              : (data.detail ?? data.error ?? t("errPdf"));
        setError(message);
        console.error(
          `Synthesis PDF download failed for plan ${planId}:`,
          data.detail ?? data.error ?? res.status,
        );
        return;
      }

      // Stream the PDF into a blob and trigger a programmatic <a download>
      // click. `revokeObjectURL` cleans up the temporary blob URL once the
      // browser has handed the file off to the OS.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().split("T")[0];
      const a = document.createElement("a");
      a.href = url;
      a.download = `klymeo-synthesis-${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revoke a tick — some browsers race with the download start.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(t("errPdfNetwork"));
      console.error(`Synthesis PDF download failed for plan ${planId}:`, err);
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
        {loading ? t("pdfExporting") : t("pdfExport")}
      </button>
      {error && (
        <span className="max-w-72 text-right text-caption text-danger-700">
          {error}
        </span>
      )}
    </div>
  );
}

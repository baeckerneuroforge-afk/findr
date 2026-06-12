"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

function defaultStart(): string {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return date.toISOString().split("T")[0] ?? "";
}

function today(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

export function LossReportPanel() {
  const t = useTranslations("sales.loss");
  const tc = useTranslations("sales.common");
  const [start, setStart] = useState(defaultStart());
  const [end, setEnd] = useState(today());
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function generateReport() {
    setLoading(true);
    setFeedback(null);
    const params = new URLSearchParams({ start, end, cache: "true" });
    const response = await fetch(`/api/loss/reports?${params.toString()}`);
    const data = (await response.json()) as {
      success?: boolean;
      report?: { total_lost_deals: number };
      error?: string;
    };
    setLoading(false);

    if (!response.ok || !data.success) {
      setFeedback(data.error ?? t("reportFailed"));
      return;
    }

    setFeedback(
      t("reportGenerated", { count: data.report?.total_lost_deals ?? 0 }),
    );
  }

  const pdfUrl = `/api/loss/reports/pdf?${new URLSearchParams({
    start,
    end,
  }).toString()}`;

  return (
    <div className="rounded-lg border border-neutral-200 bg-card p-5">
      <div className="mb-4">
        <h3 className="text-h3 text-neutral-900">{t("quarterlyTitle")}</h3>
        <p className="text-small text-neutral-500">{t("quarterlyDesc")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
        <label>
          <span className="mb-1 block text-small font-medium text-neutral-700">
            {t("start")}
          </span>
          <input
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-body text-neutral-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </label>

        <label>
          <span className="mb-1 block text-small font-medium text-neutral-700">
            {t("end")}
          </span>
          <input
            type="date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-body text-neutral-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </label>

        <Button onClick={generateReport} disabled={loading}>
          {loading ? t("generating") : t("generate")}
        </Button>

        <a
          href={pdfUrl}
          download
          className="inline-flex h-8 items-center justify-center rounded-md border border-neutral-200 bg-card px-3 text-body-strong text-neutral-900 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
        >
          {tc("downloadPdf")}
        </a>
      </div>

      {feedback && (
        <div className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-small text-neutral-700">
          {feedback}
        </div>
      )}
    </div>
  );
}

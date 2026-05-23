"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EvidenceQuote } from "@/components/dashboard/EvidenceQuote";
import type { SolutionReport } from "@/lib/solution/service";

interface SolutionPanelProps {
  dealId: string;
  initialReport: SolutionReport | null;
}

type Salvageable = "yes" | "no" | "maybe";

function formatSignal(signal: string): string {
  return signal
    .split("_")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}

function verdictHeaderStyle(s: Salvageable): string {
  if (s === "yes") return "bg-success-50 border-success-500/30";
  if (s === "no") return "bg-danger-50 border-danger-500/30";
  return "bg-neutral-50 border-primary-500/25";
}

function verdictBadgeStyle(s: Salvageable): string {
  if (s === "yes") return "border-success-500/30 bg-success-50 text-success-700";
  if (s === "no") return "border-danger-500 bg-danger-500 text-white";
  return "border-primary-200 bg-primary-50 text-primary-700";
}

function verdictLabel(s: Salvageable): string {
  if (s === "yes") return "Salvageable";
  if (s === "no") return "Hard to save";
  return "Uncertain";
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function SolutionReportView({ report }: { report: SolutionReport }) {
  const salvageable: Salvageable =
    report.salvageable ?? report.overall.salvageable ?? "maybe";
  const reasoning = report.overall.reasoning;
  const recommendations = report.recommendations ?? [];

  return (
    <div className="space-y-6">
      {/* Overall verdict */}
      <div className={`rounded-lg border p-6 ${verdictHeaderStyle(salvageable)}`}>
        <div className="mb-2 text-caption uppercase tracking-wider text-neutral-500">
          Can this deal be saved?
        </div>
        <span
          className={`inline-block rounded-md border px-2 py-0.5 text-caption font-semibold uppercase ${verdictBadgeStyle(salvageable)}`}
        >
          {verdictLabel(salvageable)}
        </span>
        {reasoning && (
          <p className="mt-3 text-body leading-relaxed text-neutral-700">
            {reasoning}
          </p>
        )}
      </div>

      {/* Healthy deal — no recommendations */}
      {recommendations.length === 0 ? (
        <div className="rounded-lg border border-success-500/30 bg-success-50 px-4 py-4 text-body leading-relaxed text-success-700">
          No rescue actions needed — this deal looks healthy. Keep the momentum
          going.
        </div>
      ) : (
        <div>
          <h4 className="mb-3 text-h3 uppercase tracking-wider text-neutral-500">
            Recommended moves ({recommendations.length})
          </h4>
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4"
              >
                <span className="inline-block rounded-md border border-primary-200 bg-primary-50 px-1.5 py-0.5 text-caption font-medium text-primary-700">
                  {formatSignal(rec.signal)}
                </span>

                <p className="text-body leading-relaxed text-neutral-900">
                  {rec.recommendation}
                </p>

                {/* Next step — highlighted */}
                <div className="rounded-md border border-primary-100 bg-primary-50 px-3 py-2">
                  <div className="mb-0.5 text-caption uppercase tracking-wider text-primary-700">
                    Next step
                  </div>
                  <p className="text-body-strong leading-relaxed text-neutral-900">
                    {rec.nextStep}
                  </p>
                </div>

                {/* Evidence quote */}
                {rec.evidence && (
                  <EvidenceQuote
                    quote={rec.evidence}
                    context="Evidence from this deal"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SolutionPanel({ dealId, initialReport }: SolutionPanelProps) {
  const [report, setReport] = useState<SolutionReport | null>(initialReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/solution/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (res.status === 404) {
          setError("Run a risk analysis for this deal first.");
        } else if (res.status === 502) {
          setError(
            "The AI couldn't generate recommendations right now. Please try again.",
          );
        } else {
          setError(
            data.error ?? "Solution generation failed. Please try again later.",
          );
        }
        console.error(
          `Solution generate failed for ${dealId}:`,
          data.error ?? res.status,
        );
        return;
      }

      const data = (await res.json()) as { report: SolutionReport };
      setReport(data.report);
    } catch (err) {
      setError("Solution generation failed. Please try again later.");
      console.error(`Solution generate failed for ${dealId}:`, err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-h3 uppercase tracking-wider text-neutral-500">
            Solution recommendations
          </h3>
          {report && (
            <p className="mt-1 text-caption text-neutral-400">
              Generated{" "}
              {new Date(report.created_at).toLocaleString("de-DE")} ·{" "}
              {report.model}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <a
              href={`/api/solution/${dealId}/pdf`}
              download
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-body-strong font-medium text-neutral-900 transition-colors duration-150 hover:border-neutral-300 hover:bg-neutral-50"
            >
              Export PDF
            </a>
          )}
          <Button
            variant={report ? "secondary" : "primary"}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner /> Generating…
              </>
            ) : report ? (
              "Regenerate"
            ) : (
              "Generate recommendations"
            )}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-small text-neutral-500">
          Generating rescue recommendations with AI — this can take a few
          seconds.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger-500/30 bg-danger-50 px-4 py-3 text-small text-danger-700">
          {error}
        </div>
      )}

      {!report && !loading && !error && (
        <div className="rounded-lg border border-dashed border-neutral-200 bg-white px-4 py-6 text-center text-small text-neutral-500">
          Generate AI rescue recommendations grounded in this deal&apos;s risk
          signals and call evidence.
        </div>
      )}

      {report && <SolutionReportView report={report} />}
    </div>
  );
}

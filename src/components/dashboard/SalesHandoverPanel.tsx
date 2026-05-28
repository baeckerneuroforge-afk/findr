"use client";

import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/**
 * Sales-Handover-Panel auf der Accounts-Seite.
 *
 * Zeigt pending Vorschläge der Brücke #2 (Sales-Won → CS-Account-
 * Startkontext): für kürzlich gewonnene Deals listet der Detector die
 * deterministisch aus deal.raw_data + risk_scores.signals abgeleiteten
 * Starter-Signale auf. Der CS-User entscheidet per Klick, ob er sie als
 * initialen Health-Score in den frischen Account übernimmt.
 *
 * Pro Card drei Aktionen:
 *   - "In Health-Score übernehmen" (approve) → POST /sales-handover/[id]/approve
 *     → server schreibt account_health_scores-Zeile (analysis_method='heuristic',
 *       source_call_id=null) → UI navigiert zum Account-Detail.
 *
 *   - "Verwerfen" (dismiss) → POST /api/bridge/suggestions/[id]/dismiss
 *     (kind-agnostischer endpoint, geteilt mit Brücke #1).
 *
 *   - "Jetzt scannen" (Top-Button) → POST /api/bridge/sales-handover/scan
 *     → deterministischer Detector läuft (kein LLM-Call). Updates die
 *     Liste inline.
 *
 * KEINE Auto-Scans, kein Polling. Wie Brücke #1: Human-Approval-Gate ist
 * Pflicht.
 */

interface SignalListItem {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  reasoning: string;
  evidence: string[];
}

interface SalesHandoverSourceRefs {
  kind?: string;
  dealId?: string;
  accountId?: string;
  dealName?: string;
  companyName?: string;
  closedAt?: string | null;
  riskScoreId?: string | null;
  signals?: SignalListItem[];
  summary?: string;
}

interface SalesHandoverSuggestion {
  id: string;
  orgId: string;
  sourceModule: "sales";
  sourceRefs: SalesHandoverSourceRefs;
  kind: "sales_handover";
  status: "pending" | "approved" | "dismissed";
  createdAt: string;
}

interface SalesHandoverPanelProps {
  initialSuggestions: SalesHandoverSuggestion[];
}

/** Deutsche Labels für die RISK_SIGNAL_TYPES — spiegelt SIGNAL_TYPE_GERMAN_LABEL
 *  in src/lib/bridge/cs-to-research.ts, dort aber für die Detail-Beschreibung;
 *  hier nutzen wir kürzere Tag-Labels passend zum Severity-Chip. */
const SIGNAL_LABEL: Record<string, string> = {
  CHAMPION_LOSS: "Champion-Verlust",
  COMPETITOR_PRESSURE: "Wettbewerbsdruck",
  STALLING_PATTERN: "Entscheidungsverzögerung",
  BUDGET_FRICTION: "Budget-Reibung",
  CHAMPION_DISENGAGEMENT: "Champion-Disengagement",
  LATE_DECISION_MAKER: "Späte Decision-Maker",
  STAKEHOLDER_CHURN: "Stakeholder-Wechsel",
  ENGAGEMENT_DROP: "Engagement-Rückgang",
  MULTI_THREADING_FAILURE: "Single-Threaded",
};

const SEVERITY_CHIP: Record<
  "low" | "medium" | "high" | "critical",
  { label: string; className: string }
> = {
  low: {
    label: "low",
    className: "bg-neutral-100 text-neutral-700 border-neutral-200",
  },
  medium: {
    label: "medium",
    className: "bg-warning-50 text-warning-700 border-warning-200",
  },
  high: {
    label: "high",
    className: "bg-danger-50 text-danger-700 border-danger-200",
  },
  critical: {
    label: "critical",
    className: "bg-danger-100 text-danger-800 border-danger-300",
  },
};

function signalTag(type: string): string {
  return SIGNAL_LABEL[type] ?? type;
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SalesHandoverPanel({
  initialSuggestions,
}: SalesHandoverPanelProps) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);

  async function handleScan(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (scanning) return;
    setScanning(true);
    setError(null);
    setScanNote(null);
    try {
      const res = await fetch("/api/bridge/sales-handover/scan", {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        scanned?: number;
        created?: number;
        skipped?: number;
        clean?: number;
        failed?: number;
        suggestions?: SalesHandoverSuggestion[];
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        setError(data.detail ?? data.error ?? "Scan fehlgeschlagen.");
        return;
      }
      if (Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
      const scanned = data.scanned ?? 0;
      const created = data.created ?? 0;
      const skipped = data.skipped ?? 0;
      const clean = data.clean ?? 0;
      const failed = data.failed ?? 0;
      const parts = [
        `${scanned} Won-Deal${scanned === 1 ? "" : "s"} gescannt`,
        `${created} neu`,
        `${skipped} schon vorhanden`,
        `${clean} sauberer Start`,
      ];
      if (failed > 0) parts.push(`${failed} fehlgeschlagen`);
      setScanNote(`Scan abgeschlossen: ${parts.join(", ")}.`);
    } catch (err) {
      setError("Scan fehlgeschlagen — Netzwerkfehler.");
      console.error("sales-handover scan failed:", err);
    } finally {
      setScanning(false);
    }
  }

  async function handleApprove(suggestion: SalesHandoverSuggestion) {
    if (busyId) return;
    setBusyId(suggestion.id);
    setError(null);
    setScanNote(null);
    try {
      const res = await fetch(
        `/api/bridge/sales-handover/${encodeURIComponent(suggestion.id)}/approve`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        accountId?: string;
        healthScoreId?: string;
        healthScore?: number;
        healthLevel?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.success || !data.accountId) {
        setError(
          data.detail ?? data.error ?? "Übernahme fehlgeschlagen.",
        );
        return;
      }
      // Optimistic: remove the card. Then redirect to the account detail
      // where the freshly written health-score is visible.
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      router.push(`/dashboard/accounts/${data.accountId}`);
    } catch (err) {
      setError("Übernahme fehlgeschlagen — Netzwerkfehler.");
      console.error(
        `sales-handover approve failed for ${suggestion.id}:`,
        err,
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismiss(suggestion: SalesHandoverSuggestion) {
    if (busyId) return;
    setBusyId(suggestion.id);
    setError(null);
    setScanNote(null);
    try {
      // Dismiss-endpoint is kind-agnostic — geteilt mit Brücke #1.
      const res = await fetch(
        `/api/bridge/suggestions/${encodeURIComponent(suggestion.id)}/dismiss`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.success) {
        setError(data.detail ?? data.error ?? "Verwerfen fehlgeschlagen.");
        return;
      }
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    } catch (err) {
      setError("Verwerfen fehlgeschlagen — Netzwerkfehler.");
      console.error(
        `sales-handover dismiss failed for ${suggestion.id}:`,
        err,
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-h3 text-neutral-900">
              Startkontext aus Sales
            </h2>
            <p className="mt-1 text-small text-neutral-500">
              Wenn ein Deal gewonnen wird, hebt diese Brücke die bekannten
              Risiken (Wettbewerber, Single-Threading, Sales-Phase-Signale)
              als Startkontext in den frischen Account. Deterministisches
              Mapping — kein LLM-Call. Du entscheidest per Klick.
            </p>
          </div>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning || busyId !== null}
            className="shrink-0 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-small font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
          >
            {scanning ? "Suche läuft…" : "Jetzt scannen"}
          </button>
        </div>
      </CardHeader>

      <CardBody>
        {error && (
          <div className="mb-3 rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
            {error}
          </div>
        )}
        {scanNote && !error && (
          <div className="mb-3 rounded-md border border-primary-200 bg-primary-50/40 px-3 py-2 text-small text-neutral-700">
            {scanNote}
          </div>
        )}

        {suggestions.length === 0 ? (
          <p className="py-3 text-center text-body text-neutral-500">
            Keine offenen Handover-Vorschläge. „Jetzt scannen" prüft die
            jüngsten gewonnenen Deals auf übertragbare Starter-Signale.
          </p>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((s) => {
              const refs = s.sourceRefs ?? {};
              const signals = Array.isArray(refs.signals) ? refs.signals : [];
              const closedAt = formatDate(refs.closedAt);
              return (
                <li
                  key={s.id}
                  className="rounded-md border border-primary-200 bg-primary-50/40 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-body-strong text-neutral-900">
                        Startkontext für „{refs.companyName ?? "Account"}"
                        übernehmen?
                      </p>
                      <p className="mt-1 text-small text-neutral-700">
                        {refs.summary ??
                          "Starter-Signale aus dem Sales-Deal sind verfügbar."}
                      </p>
                      {signals.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {signals.map((sig, idx) => {
                            const chip =
                              SEVERITY_CHIP[sig.severity] ??
                              SEVERITY_CHIP.medium;
                            return (
                              <li
                                key={`${s.id}-sig-${idx}`}
                                className="flex items-start gap-2 text-small text-neutral-700"
                              >
                                <span
                                  className={`mt-0.5 inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-caption font-medium ${chip.className}`}
                                >
                                  {chip.label}
                                </span>
                                <span className="min-w-0">
                                  <span className="font-medium text-neutral-900">
                                    {signalTag(sig.type)}
                                  </span>
                                  {" — "}
                                  <span className="text-neutral-600">
                                    {sig.reasoning}
                                  </span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <p className="mt-2 font-mono text-caption text-neutral-400">
                        Deal: {refs.dealName ?? "—"}
                        {closedAt ? ` · gewonnen am ${closedAt}` : ""}
                        {" · "}sales_handover (deterministisch)
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(s)}
                        disabled={busyId !== null || scanning}
                        className="w-44 rounded-md border border-primary-600 bg-primary-600 px-3 py-1.5 text-small font-medium text-white transition-colors hover:border-primary-700 hover:bg-primary-700 disabled:opacity-50"
                      >
                        {busyId === s.id
                          ? "Wird übernommen…"
                          : "In Health-Score übernehmen"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismiss(s)}
                        disabled={busyId !== null || scanning}
                        className="w-44 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-small font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
                      >
                        Verwerfen
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

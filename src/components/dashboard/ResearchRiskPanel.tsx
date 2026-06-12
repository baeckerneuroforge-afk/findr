"use client";

import { useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/**
 * Research-Risk-Watch-Panel auf der Forecast-Seite.
 *
 * Zeigt zwei Sektionen aus bridge_suggestions (kind='research_to_risk'):
 *
 *   - „Vorschläge" (pending): pro Card der vom LLM abgeleitete Kandidat
 *     (candidateName + mappedRiskType + reasoning) UND das ursprüngliche
 *     Synthese-Thema (themeTitle, frequency, optional 1-3 Quotes).
 *     Aktionen: "Auf Watch-Liste setzen" (approve) und "Verwerfen".
 *
 *   - „Watch-Liste" (approved): Read-only-Anzeige der team-bestätigten
 *     Muster. Sales-Reps lesen das als „diese Research-Themen sollten wir
 *     bei der Deal-Bewertung mitdenken". Sekundäre Aktion: "Entfernen"
 *     (verwerfen — räumt aus der Liste raus, kein Rollback im Sales-
 *     Classifier — der weiß nichts davon).
 *
 * Top-Button: „Aus Synthesen scannen" — ruft POST /api/bridge/research-
 * to-sales/scan. EIN Opus-Call pro neuem emergent_theme über die
 * Frequenz-Schwelle; Re-Scans sind dank Dedup billig (skipped).
 *
 * Brücke #3 ist KEIN Auto-Apply — die Risk-Klassifikation bleibt
 * classifier-intern. Die Watch-Liste ist ein menschlicher Watchpoint.
 */

interface ResearchRiskSourceRefs {
  kind?: string;
  planId?: string;
  planTitle?: string | null;
  themeTitle?: string;
  themeSummary?: string;
  frequency?: number;
  quotes?: string[];
  candidateName?: string | null;
  mappedRiskType?: string | null;
  reasoning?: string | null;
  derivable?: boolean;
}

interface ResearchRiskSuggestion {
  id: string;
  orgId: string;
  sourceModule: "research";
  sourceRefs: ResearchRiskSourceRefs;
  kind: "research_to_risk";
  status: "pending" | "approved" | "dismissed";
  decidedAt: string | null;
  createdAt: string;
}

interface ResearchRiskPanelProps {
  initialSuggestions: ResearchRiskSuggestion[];
}

// Risk-type vocabulary is analysis taxonomy — kept in the source language
// (German) in both locales, interpolated into the translated chrome.
const RISK_TYPE_LABELS: Record<string, string> = {
  CHAMPION_LOSS: "Champion-Verlust",
  COMPETITOR_PRESSURE: "Wettbewerbsdruck",
  STALLING_PATTERN: "Entscheidungsverzögerung",
  BUDGET_FRICTION: "Budget-Reibung",
  CHAMPION_DISENGAGEMENT: "Champion-Disengagement",
  LATE_DECISION_MAKER: "Späte Decision-Maker",
  STAKEHOLDER_CHURN: "Stakeholder-Wechsel",
  ENGAGEMENT_DROP: "Engagement-Rückgang",
  MULTI_THREADING_FAILURE: "Single-Threaded",
  UNKLASSIFIZIERT: "Unklassifiziert",
};

function typeLabel(mapped: string | null | undefined): string {
  if (!mapped) return "—";
  return RISK_TYPE_LABELS[mapped] ?? mapped;
}

function typeChipClass(mapped: string | null | undefined): string {
  if (!mapped) return "bg-neutral-100 text-neutral-700 border-neutral-200";
  if (mapped === "UNKLASSIFIZIERT")
    return "bg-neutral-100 text-neutral-700 border-neutral-200";
  return "bg-primary-50 text-primary-700 border-primary-200";
}

export function ResearchRiskPanel({
  initialSuggestions,
}: ResearchRiskPanelProps) {
  const t = useTranslations("research.bridge");
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);

  const pending = suggestions.filter((s) => s.status === "pending");
  const approved = suggestions.filter((s) => s.status === "approved");

  async function handleScan(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (scanning) return;
    setScanning(true);
    setError(null);
    setScanNote(null);
    try {
      const res = await fetch("/api/bridge/research-to-sales/scan", {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        scanned?: number;
        created?: number;
        skipped?: number;
        refused?: number;
        failed?: number;
        suggestions?: ResearchRiskSuggestion[];
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        setError(data.detail ?? data.error ?? t("errScan"));
        return;
      }
      if (Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
      const parts = [
        t("rrScanScanned", { count: data.scanned ?? 0 }),
        t("rrScanCreated", { count: data.created ?? 0 }),
        t("rrScanSkipped", { count: data.skipped ?? 0 }),
        t("rrScanRefused", { count: data.refused ?? 0 }),
      ];
      if ((data.failed ?? 0) > 0)
        parts.push(t("rrScanFailed", { count: data.failed ?? 0 }));
      setScanNote(t("rrScanDone", { parts: parts.join(", ") }));
    } catch (err) {
      setError(t("errScanNetwork"));
      console.error("research-risk scan failed:", err);
    } finally {
      setScanning(false);
    }
  }

  async function handleApprove(suggestion: ResearchRiskSuggestion) {
    if (busyId) return;
    setBusyId(suggestion.id);
    setError(null);
    setScanNote(null);
    try {
      const res = await fetch(
        `/api/bridge/research-to-sales/${encodeURIComponent(suggestion.id)}/approve`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        suggestion?: ResearchRiskSuggestion;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.success || !data.suggestion) {
        setError(data.detail ?? data.error ?? t("errApproveWatch"));
        return;
      }
      // Move the row from pending to approved in-place.
      const approvedRow = data.suggestion;
      setSuggestions((prev) =>
        prev.map((s) => (s.id === suggestion.id ? approvedRow : s)),
      );
    } catch (err) {
      setError(t("errApproveWatchNetwork"));
      console.error(
        `research-risk approve failed for ${suggestion.id}:`,
        err,
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismiss(suggestion: ResearchRiskSuggestion) {
    if (busyId) return;
    setBusyId(suggestion.id);
    setError(null);
    setScanNote(null);
    try {
      // Dismiss-endpoint ist kind-agnostisch — geteilt mit Brücke #1/#2.
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
        setError(data.detail ?? data.error ?? t("errAction"));
        return;
      }
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    } catch (err) {
      setError(t("errActionNetwork"));
      console.error(
        `research-risk dismiss failed for ${suggestion.id}:`,
        err,
      );
    } finally {
      setBusyId(null);
    }
  }

  function renderPendingCard(s: ResearchRiskSuggestion) {
    const refs = s.sourceRefs ?? {};
    const derivable = refs.derivable === true && refs.candidateName !== null;
    const quotes = Array.isArray(refs.quotes) ? refs.quotes : [];
    return (
      <li
        key={s.id}
        className="rounded-md border border-primary-200 bg-primary-50/40 p-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {derivable ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-body-strong text-neutral-900">
                    {refs.candidateName}
                  </p>
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-0.5 text-caption font-medium ${typeChipClass(refs.mappedRiskType)}`}
                  >
                    {typeLabel(refs.mappedRiskType)}
                  </span>
                </div>
                {refs.reasoning && (
                  <p className="mt-1 text-small text-neutral-700">
                    {refs.reasoning}
                  </p>
                )}
              </>
            ) : (
              <p className="text-body-strong text-neutral-700">
                {t("rrNoCandidate", { title: refs.themeTitle ?? "—" })}
              </p>
            )}
            <p className="mt-2 text-small text-neutral-600">
              <span className="font-medium">{t("rrFromSynthesis")}</span>{" "}
              {refs.planTitle ?? t("rrPlanFallback")} —{" "}
              <span className="italic">„{refs.themeTitle ?? "?"}"</span>{" "}
              <span className="text-neutral-400">
                {t("rrRespondents", { count: refs.frequency ?? 0 })}
              </span>
            </p>
            {quotes.length > 0 && (
              <ul className="mt-2 space-y-1 border-l-2 border-neutral-200 pl-3">
                {quotes.slice(0, 3).map((q, i) => (
                  <li
                    key={`${s.id}-q-${i}`}
                    className="text-small italic text-neutral-600"
                  >
                    „{q}"
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 font-mono text-caption text-neutral-400">
              research_to_risk · bridge_suggestions
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => handleApprove(s)}
              disabled={busyId !== null || scanning}
              className="w-44 rounded-md border border-primary-600 bg-primary-600 px-3 py-1.5 text-small font-medium text-white transition-colors hover:border-primary-hover hover:bg-primary-hover disabled:opacity-50"
            >
              {busyId === s.id ? t("rrSetting") : t("rrSetWatch")}
            </button>
            <button
              type="button"
              onClick={() => handleDismiss(s)}
              disabled={busyId !== null || scanning}
              className="w-44 rounded-md border border-neutral-200 bg-card px-3 py-1.5 text-small font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
            >
              {t("dismiss")}
            </button>
          </div>
        </div>
      </li>
    );
  }

  function renderApprovedCard(s: ResearchRiskSuggestion) {
    const refs = s.sourceRefs ?? {};
    return (
      <li
        key={s.id}
        className="rounded-md border border-neutral-200 bg-card p-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-body-strong text-neutral-900">
                {refs.candidateName ??
                  t("rrThemeFallback", {
                    title: refs.themeTitle ?? t("rrThemeUnnamed"),
                  })}
              </p>
              <span
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-caption font-medium ${typeChipClass(refs.mappedRiskType)}`}
              >
                {typeLabel(refs.mappedRiskType)}
              </span>
            </div>
            {refs.reasoning && (
              <p className="mt-1 text-small text-neutral-700">
                {refs.reasoning}
              </p>
            )}
            <p className="mt-2 text-small text-neutral-500">
              <span className="font-medium">{t("rrSource")}</span>{" "}
              {refs.planTitle ?? t("rrPlanFallback")} —{" "}
              <span className="italic">„{refs.themeTitle ?? "?"}"</span>{" "}
              <span className="text-neutral-400">
                {t("rrRespondents", { count: refs.frequency ?? 0 })}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDismiss(s)}
            disabled={busyId !== null || scanning}
            className="shrink-0 rounded-md border border-neutral-200 bg-card px-3 py-1.5 text-small font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
          >
            {busyId === s.id ? t("rrRemoving") : t("rrRemoveFromList")}
          </button>
        </div>
      </li>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-h3 text-neutral-900">{t("rrTitle")}</h2>
            <p className="mt-1 text-small text-neutral-500">{t("rrSubtitle")}</p>
          </div>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning || busyId !== null}
            className="shrink-0 rounded-md border border-neutral-200 bg-card px-3 py-1.5 text-small font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
          >
            {scanning ? t("scanning") : t("rrScan")}
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

        {pending.length === 0 && approved.length === 0 ? (
          <p className="py-3 text-center text-body text-neutral-500">
            {t("rrEmpty")}
          </p>
        ) : (
          <div className="space-y-6">
            {pending.length > 0 && (
              <section>
                <h3 className="mb-2 text-small font-semibold text-neutral-700">
                  {t("rrProposalsTitle", { count: pending.length })}
                </h3>
                <ul className="space-y-3">
                  {pending.map(renderPendingCard)}
                </ul>
              </section>
            )}

            {approved.length > 0 && (
              <section>
                <h3 className="mb-2 text-small font-semibold text-neutral-700">
                  {t("rrWatchListTitle", { count: approved.length })}
                </h3>
                <ul className="space-y-2">
                  {approved.map(renderApprovedCard)}
                </ul>
              </section>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

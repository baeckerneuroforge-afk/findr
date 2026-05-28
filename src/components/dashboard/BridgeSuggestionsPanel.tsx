"use client";

import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/**
 * Bridge-Suggestions-Panel auf der Research-Plans-Index-Seite.
 *
 * Zeigt die pending Suggestions, die der Detector aus CS-Health (oder
 * künftigen Modulen) abgeleitet hat. Pro Card drei Aktionen:
 *
 *   - "Studie starten" (approve) → POST /[id]/approve → server erzeugt
 *     research_plan + ruft generateInterviewGuide → UI navigiert zur
 *     Plan-Detail-Seite.
 *
 *   - "Verwerfen" (dismiss) → POST /[id]/dismiss → server markiert
 *     status='dismissed'. UI entfernt die Card aus der lokalen Liste.
 *
 *   - "Scan now" (Top-Button) → POST /api/bridge/suggestions → Detector
 *     läuft (1 Opus-Call pro neuem Cluster). Updates the list inline.
 *
 * KEINE Auto-Scans, kein Polling — der Detector läuft NUR auf expliziten
 * Klick. Human-Approval-Gate ist Pflicht: ohne approve-Klick wird kein
 * research_plan angelegt.
 */

interface BridgeSourceRefs {
  kind?: string;
  signalType?: string;
  accountIds?: string[];
  windowDays?: number;
}

interface BridgeSuggestion {
  id: string;
  orgId: string;
  sourceModule: string;
  sourceRefs: BridgeSourceRefs;
  kind: string;
  derivedGoal: string | null;
  segment: string | null;
  status: "pending" | "approved" | "dismissed";
  createdAt: string;
}

interface BridgeSuggestionsPanelProps {
  initialSuggestions: BridgeSuggestion[];
}

/** German labels for the signal types — matches SIGNAL_TYPE_GERMAN_LABEL
 *  in src/lib/bridge/cs-to-research.ts so the card text reads consistently
 *  with what the LLM saw. */
const SIGNAL_LABEL: Record<string, string> = {
  CHAMPION_LOSS: "Verlust des internen Champions",
  COMPETITOR_PRESSURE: "Druck durch Wettbewerber",
  STALLING_PATTERN: "Entscheidungsverzögerung",
  BUDGET_FRICTION: "Budget-Reibung",
  CHAMPION_DISENGAGEMENT: "Champion-Disengagement",
  LATE_DECISION_MAKER: "Spät auftauchender Decision-Maker",
  STAKEHOLDER_CHURN: "Stakeholder-Wechsel",
  ENGAGEMENT_DROP: "Engagement-Rückgang",
  MULTI_THREADING_FAILURE: "Fehlende Multi-Threading-Beziehung",
};

function labelFor(s: BridgeSuggestion): string {
  const sig = s.sourceRefs.signalType;
  if (!sig) return "CS-Churn-Muster";
  return SIGNAL_LABEL[sig] ?? sig;
}

export function BridgeSuggestionsPanel({
  initialSuggestions,
}: BridgeSuggestionsPanelProps) {
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
      const res = await fetch("/api/bridge/suggestions", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        scanned?: number;
        created?: number;
        skipped?: number;
        failed?: number;
        suggestions?: BridgeSuggestion[];
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
      const failed = data.failed ?? 0;
      setScanNote(
        `Scan abgeschlossen: ${scanned} Cluster gefunden, ${created} neu, ${skipped} schon vorhanden${failed > 0 ? `, ${failed} fehlgeschlagen` : ""}.`,
      );
    } catch (err) {
      setError("Scan fehlgeschlagen — Netzwerkfehler.");
      console.error("bridge scan failed:", err);
    } finally {
      setScanning(false);
    }
  }

  async function handleApprove(suggestion: BridgeSuggestion) {
    if (busyId) return;
    setBusyId(suggestion.id);
    setError(null);
    setScanNote(null);
    try {
      const res = await fetch(
        `/api/bridge/suggestions/${encodeURIComponent(suggestion.id)}/approve`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        planId?: string;
        guideGenerated?: boolean;
        guideError?: string | null;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.success || !data.planId) {
        setError(data.detail ?? data.error ?? "Studie konnte nicht angelegt werden.");
        return;
      }
      // Optimistic: remove the card. Then redirect to the new plan. If
      // guide-gen failed, we still navigate — the user lands on the
      // plan-edit screen and can manually fill topics.
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      router.push(`/dashboard/research-plans/${data.planId}`);
    } catch (err) {
      setError("Studie konnte nicht angelegt werden — Netzwerkfehler.");
      console.error(`bridge approve failed for ${suggestion.id}:`, err);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismiss(suggestion: BridgeSuggestion) {
    if (busyId) return;
    setBusyId(suggestion.id);
    setError(null);
    setScanNote(null);
    try {
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
      console.error(`bridge dismiss failed for ${suggestion.id}:`, err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-h3 text-neutral-900">Vorschläge aus CS-Health</h2>
            <p className="mt-1 text-small text-neutral-500">
              Wenn mehrere Accounts mit demselben Churn-Grund verloren gehen,
              schlägt die Brücke hier eine Research-Studie vor. Du
              entscheidest per Klick — kein Auto-Run.
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
            Aktuell keine offenen Vorschläge. „Jetzt scannen" prüft die
            jüngsten Kündigungen auf wiederkehrende Muster.
          </p>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="rounded-md border border-primary-200 bg-primary-50/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-body-strong text-neutral-900">
                      Aus CS-Churn: Studie zu „{labelFor(s)}" starten?
                    </p>
                    <p className="mt-1 text-small text-neutral-600">
                      {s.derivedGoal && s.derivedGoal.trim().length > 0
                        ? s.derivedGoal
                        : "Die KI konnte aus diesem Cluster kein eindeutiges Ziel ableiten — du kannst die Studie trotzdem starten und das Ziel nach Erstellung anpassen."}
                    </p>
                    <p className="mt-2 font-mono text-caption text-neutral-400">
                      {s.sourceRefs.accountIds?.length ?? 0} verlorene Accounts
                      {s.sourceRefs.windowDays
                        ? ` · letzte ${s.sourceRefs.windowDays} Tage`
                        : ""}
                      {" · "}
                      {s.sourceModule}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(s)}
                      disabled={busyId !== null || scanning}
                      className="w-32 rounded-md border border-primary-600 bg-primary-600 px-3 py-1.5 text-small font-medium text-white transition-colors hover:border-primary-700 hover:bg-primary-700 disabled:opacity-50"
                    >
                      {busyId === s.id ? "Wird erstellt…" : "Studie starten"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismiss(s)}
                      disabled={busyId !== null || scanning}
                      className="w-32 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-small font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Verwerfen
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { HealthBadge } from "@/components/dashboard/HealthBadge";
import { RiskHistoryChart } from "@/components/dashboard/RiskHistoryChart";
import { RiskSignalDrilldown } from "@/components/dashboard/RiskSignalDrilldown";
import type { HealthLevel } from "@/lib/accounts/types";
import type { RiskSignal } from "@/lib/schemas/risk";

interface HealthLatest {
  healthScore: number;
  healthLevel: HealthLevel;
  overallReasoning: string;
  recommendations: string[];
  signals: RiskSignal[];
  analysisMethod: "ai" | "heuristic";
  analyzedAt: string;
}

interface AccountHealthPanelProps {
  accountId: string;
  latest: HealthLatest | null;
  history: { date: string; score: number; level: HealthLevel }[];
  transcriptCount: number;
}

type RiskLevel = "low" | "medium" | "high" | "critical";

const TEXTAREA_CLASS =
  "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 disabled:opacity-60";

/** Health dot color reuses the risk palette buckets: healthy=green, at_risk=orange, critical=red. */
function healthLevelToColorBucket(level: HealthLevel): RiskLevel {
  if (level === "healthy") return "low";
  if (level === "critical") return "critical";
  return "high";
}

function riskLevelFromScore(risk: number): RiskLevel {
  if (risk < 40) return "low";
  if (risk < 60) return "medium";
  if (risk < 80) return "high";
  return "critical";
}

export function AccountHealthPanel({
  accountId,
  latest,
  history,
  transcriptCount,
}: AccountHealthPanelProps) {
  const router = useRouter();
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (transcript.trim() === "" || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      setTranscript("");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  const chartHistory = history.map((point) => ({
    date: point.date,
    score: point.score,
    level: healthLevelToColorBucket(point.level),
  }));

  const riskScore = latest ? 100 - latest.healthScore : undefined;
  const disabled = busy || pending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-h2 text-neutral-900">Health score</h2>
          {latest && (
            <HealthBadge
              score={latest.healthScore}
              level={latest.healthLevel}
              size="large"
            />
          )}
        </CardHeader>
        <CardBody className="space-y-4">
          {/* Honesty: always say what the score is based on. */}
          {latest ? (
            <p className="text-small text-neutral-500">
              Based on {transcriptCount}{" "}
              {transcriptCount === 1 ? "transcript" : "transcripts"} · last
              analyzed {new Date(latest.analyzedAt).toLocaleString("de-DE")}
              {latest.analysisMethod === "heuristic" &&
                " · heuristic fallback (AI model was unavailable)"}
              {transcriptCount === 1 && (
                <>
                  {" "}
                  — this is a single data point; add more transcripts for a
                  fuller picture.
                </>
              )}
            </p>
          ) : (
            <p className="text-small text-neutral-500">
              No analysis yet. Paste a post-sale conversation transcript (a
              check-in, support call, QBR…) and Findr will score the account&apos;s
              health using the same engine that scores deal risk.
            </p>
          )}

          <textarea
            className={TEXTAREA_CLASS}
            rows={6}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste the call transcript here…"
            disabled={disabled}
          />

          <div className="flex items-center gap-3">
            <Button onClick={analyze} disabled={disabled || transcript.trim() === ""}>
              {busy
                ? "Analyzing… (Claude is reading the transcript)"
                : latest
                  ? "Analyze new transcript"
                  : "Analyze transcript"}
            </Button>
            {error && <span className="text-small text-danger-700">{error}</span>}
          </div>
        </CardBody>
      </Card>

      {chartHistory.length >= 2 && (
        <RiskHistoryChart
          history={chartHistory}
          title="Health score over time"
          higherIsBetter
          thresholdValue={40}
        />
      )}

      {latest && riskScore !== undefined && (
        <div className="space-y-3">
          <p className="text-small text-neutral-500">
            Health is the inverse of churn risk. The breakdown below shows the
            risk signals the engine detected in the transcript(s) — fewer and
            weaker signals mean a healthier account.
          </p>
          <RiskSignalDrilldown
            riskScore={riskScore}
            riskLevel={riskLevelFromScore(riskScore)}
            overallReasoning={latest.overallReasoning}
            recommendations={latest.recommendations}
            signals={latest.signals}
            analyzedAt={latest.analyzedAt}
            analysisMethod={latest.analysisMethod}
          />
        </div>
      )}
    </div>
  );
}

export default AccountHealthPanel;

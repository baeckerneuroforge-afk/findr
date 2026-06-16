"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { DEFAULT_PERSONAS } from "@/lib/synthetic/personas";

/**
 * Client driver for the Market-Research synthetic dry-run (Stufe 1).
 *
 * Starts a run, then loops POST /step until the run settles — re-rendering after
 * each step so the synthetic transcripts and the test synthesis appear live. The
 * unmissable disclaimer (synthetic ≠ real market opinion) is rendered both on the
 * page and inside the setup card, so it is impossible to start a run without
 * seeing it.
 *
 * Mirrors the fetch + status→i18n + Card/Button/Badge conventions of
 * MissionControlPanel / OpenLinkPanel. All real-data separation lives server-side
 * (separate synthetic_test_* tables); this component only ever talks to the
 * /api/market-research/[planId]/synthetic-test endpoints.
 */

// ── API mirror types ────────────────────────────────────────────────────────

interface Turn {
  role: "agent" | "customer";
  text: string;
}
interface SessionView {
  id: string;
  personaLabel: string;
  personaPrompt: string;
  status: "pending" | "running" | "completed" | "failed";
  conversation: Turn[];
  transcript: string | null;
  insightSummary: string | null;
  findingCount: number;
  error: string | null;
  position: number;
}
interface TensionSideView {
  label: string;
  sourceInsightIds: string[];
  quotes: string[];
}
interface ThemeView {
  title: string;
  summary: string;
  frequency: number;
  sourceInsightIds: string[];
  quotes: string[];
}
interface SynthesisView {
  overview: string;
  emergent_themes: ThemeView[];
  tensions: { description: string; side_a: TensionSideView; side_b: TensionSideView }[];
}
export interface SyntheticRunView {
  runId: string;
  status: "running" | "completed" | "failed";
  language: "de" | "en";
  requestedCount: number;
  step: number;
  totalSteps: number;
  sessions: SessionView[];
  synthesis: SynthesisView | null;
  synthesisModel: string | null;
  error: string | null;
  createdAt: string;
}
interface ApiResponse {
  success?: boolean;
  run?: SyntheticRunView;
  error?: string;
  detail?: string;
}

interface CustomPersona {
  label: string;
  prompt: string;
}

const STATUS_BADGE: Record<SessionView["status"], BadgeVariant> = {
  pending: "default",
  running: "medium",
  completed: "success",
  failed: "critical",
};

export function SyntheticTestPanel({
  planId,
  initialRun,
}: {
  planId: string;
  initialRun: SyntheticRunView | null;
}) {
  const t = useTranslations("syntheticTest");

  const [run, setRun] = useState<SyntheticRunView | null>(initialRun);
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup form state.
  const [language, setLanguage] = useState<"de" | "en">(
    initialRun?.language ?? "de",
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(DEFAULT_PERSONAS.map((p) => p.id)),
  );
  const [customs, setCustoms] = useState<CustomPersona[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // A settled (completed/failed) run shows results; an unfinished run that we're
  // not actively looping (e.g. after a reload) is "resumable".
  const settled = run !== null && run.status !== "running";
  const resumable = run !== null && run.status === "running" && !running;
  const showSetup = run === null;

  // While a dry run is actively looping (each step is a real model call), guard
  // against an accidental tab-close / navigation that would silently abandon it
  // mid-flight — enforcing the "keep the tab open" hint. The run stays resumable
  // server-side either way, so this only prevents accidental loss, never data.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  // id → persona label, to translate the synthesis's sourceInsightIds (session
  // ids) back into human persona labels.
  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    run?.sessions.forEach((s) => m.set(s.id, s.personaLabel));
    return m;
  }, [run]);

  function messageFor(res: Response, data: ApiResponse): string {
    if (res.status === 401 || res.status === 403) return t("errNoAccess");
    if (res.status === 404) return t("errNotFound");
    return data.error ?? t("errEngine");
  }

  function buildPersonasPayload() {
    const defaults = DEFAULT_PERSONAS.filter((p) => selected.has(p.id)).map(
      (p) => ({
        id: p.id,
        label: t(`persona.${p.id}.label`),
        prompt: p.prompt,
      }),
    );
    const custom = customs
      .filter((c) => c.label.trim() && c.prompt.trim())
      .map((c) => ({
        id: null,
        label: c.label.trim(),
        prompt: c.prompt.trim(),
      }));
    return [...defaults, ...custom];
  }

  async function postStep(runId: string): Promise<SyntheticRunView | null> {
    const res = await fetch(
      `/api/market-research/${planId}/synthetic-test/${runId}/step`,
      { method: "POST", headers: { "Content-Type": "application/json" } },
    );
    const data = (await res.json().catch(() => ({}))) as ApiResponse;
    if (!res.ok || !data.success || !data.run) {
      setError(messageFor(res, data));
      console.error(
        "synthetic-test step failed:",
        data.detail ?? data.error ?? res.status,
      );
      return null;
    }
    return data.run;
  }

  // Loop POST /step until the run settles. Bounded by totalSteps + 2 as a guard
  // against a never-settling server.
  async function driveToCompletion(start: SyntheticRunView) {
    setRunning(true);
    setError(null);
    let current = start;
    setRun(current);
    const maxIterations = current.totalSteps + 2;
    try {
      let i = 0;
      while (current.status === "running" && i < maxIterations) {
        const next = await postStep(current.runId);
        if (!next) return; // error already set
        current = next;
        setRun(current);
        i++;
      }
    } catch (err) {
      setError(t("errNetwork"));
      console.error("synthetic-test loop failed:", err);
    } finally {
      setRunning(false);
    }
  }

  async function handleStart() {
    if (running) return;
    const personas = buildPersonasPayload();
    if (personas.length === 0) {
      setError(t("mustSelectPersona"));
      return;
    }
    setError(null);
    setRunning(true);
    try {
      const res = await fetch(`/api/market-research/${planId}/synthetic-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, personas }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || !data.success || !data.run) {
        setError(messageFor(res, data));
        console.error(
          "synthetic-test start failed:",
          data.detail ?? data.error ?? res.status,
        );
        setRunning(false);
        return;
      }
      await driveToCompletion(data.run);
    } catch (err) {
      setError(t("errNetwork"));
      console.error("synthetic-test start failed:", err);
      setRunning(false);
    }
  }

  async function handleDelete() {
    if (!run || deleting) return;
    if (!window.confirm(t("deleteConfirm"))) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/market-research/${planId}/synthetic-test/${run.runId}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || !data.success) {
        setError(messageFor(res, data));
        return;
      }
      setRun(null);
    } catch (err) {
      setError(t("errNetwork"));
      console.error("synthetic-test delete failed:", err);
    } finally {
      setDeleting(false);
    }
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startNew() {
    setRun(null);
    setError(null);
  }

  const selectedCount =
    DEFAULT_PERSONAS.filter((p) => selected.has(p.id)).length +
    customs.filter((c) => c.label.trim() && c.prompt.trim()).length;

  const pct =
    run && run.totalSteps > 0
      ? Math.min(100, Math.round((run.step / run.totalSteps) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* Unmissable disclaimer — rendered as the very first element of the
          dry-run surface, so it is impossible to start a run without seeing it. */}
      <Disclaimer
        title={t("disclaimerTitle")}
        body={t("disclaimerBody")}
      />

      {/* ── Setup ── */}
      {showSetup && (
        <Card>
          <CardHeader>
            <h2 className="text-h3 text-neutral-900">{t("setupTitle")}</h2>
            <p className="mt-1 text-small text-neutral-500">{t("setupDesc")}</p>
          </CardHeader>
          <CardBody className="space-y-6">
            {/* Language */}
            <div>
              <div className="mb-1.5 text-caption font-medium uppercase tracking-wider text-neutral-400">
                {t("languageLabel")}
              </div>
              <div className="inline-flex overflow-hidden rounded-md border border-neutral-200">
                {(["de", "en"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={`px-3 py-1.5 text-small transition-colors ${
                      language === lang
                        ? "bg-primary-600 text-white"
                        : "bg-card text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {lang === "de" ? t("langDe") : t("langEn")}
                  </button>
                ))}
              </div>
            </div>

            {/* Default personas */}
            <div>
              <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                {t("personasLabel")}
              </div>
              <p className="mt-0.5 mb-2 text-small text-neutral-500">
                {t("personasDesc")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {DEFAULT_PERSONAS.map((p) => {
                  const checked = selected.has(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex cursor-pointer gap-2.5 rounded-md border p-3 transition-colors ${
                        checked
                          ? "border-primary-300 bg-primary-50/40"
                          : "border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary-600"
                        checked={checked}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            return next;
                          })
                        }
                      />
                      <span>
                        <span className="block text-body-strong text-neutral-900">
                          {t(`persona.${p.id}.label`)}
                        </span>
                        <span className="mt-0.5 block text-small text-neutral-500">
                          {t(`persona.${p.id}.blurb`)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Custom personas */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                  {t("customTitle")}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCustoms((prev) => [...prev, { label: "", prompt: "" }])
                  }
                >
                  + {t("addCustom")}
                </Button>
              </div>
              {customs.length > 0 && (
                <div className="space-y-3">
                  {customs.map((c, i) => (
                    <div
                      key={i}
                      className="space-y-2 rounded-md border border-neutral-200 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={c.label}
                          placeholder={t("customLabelPlaceholder")}
                          onChange={(e) =>
                            setCustoms((prev) =>
                              prev.map((x, xi) =>
                                xi === i ? { ...x, label: e.target.value } : x,
                              ),
                            )
                          }
                          className="flex-1 rounded-md border border-neutral-200 px-2.5 py-1.5 text-small focus:border-primary-400 focus:outline-none"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setCustoms((prev) => prev.filter((_, xi) => xi !== i))
                          }
                        >
                          {t("removeCustom")}
                        </Button>
                      </div>
                      <textarea
                        value={c.prompt}
                        placeholder={t("customPromptPlaceholder")}
                        rows={2}
                        onChange={(e) =>
                          setCustoms((prev) =>
                            prev.map((x, xi) =>
                              xi === i ? { ...x, prompt: e.target.value } : x,
                            ),
                          )
                        }
                        className="w-full rounded-md border border-neutral-200 px-2.5 py-1.5 text-small focus:border-primary-400 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={handleStart}
                disabled={running || selectedCount === 0}
              >
                {running ? t("running") : t("start")}
              </Button>
              <span className="text-small text-neutral-500">
                {t("selectedCount", { count: selectedCount })}
              </span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Progress / results ── */}
      {run && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-h3 text-neutral-900">
                {t("participantsTitle")}
              </h2>
              {running && <Badge variant="medium">{t("running")}</Badge>}
              {resumable && <Badge variant="medium">{t("paused")}</Badge>}
              {run.status === "completed" && (
                <Badge variant="success">{t("done")}</Badge>
              )}
              {run.status === "failed" && (
                <Badge variant="critical">{t("runFailed")}</Badge>
              )}
            </div>
          </CardHeader>
          <CardBody className="space-y-5">
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-small text-neutral-600">
                <span>{t("progressLabel")}</span>
                <span>
                  {t("stepOf", { step: run.step, total: run.totalSteps })}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    run.status === "failed"
                      ? "bg-danger-500"
                      : run.status === "completed"
                        ? "bg-success-500"
                        : "bg-primary-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {running && (
                <p className="text-small text-neutral-500">{t("runningHint")}</p>
              )}
              {resumable && (
                <p className="text-small text-neutral-500">{t("pausedHint")}</p>
              )}
            </div>

            {/* Sessions */}
            <ul className="space-y-3">
              {run.sessions.map((s) => (
                <li
                  key={s.id}
                  className="rounded-md border border-neutral-200"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-body-strong text-neutral-900">
                        {s.personaLabel}
                      </span>
                      <Badge variant={STATUS_BADGE[s.status]}>
                        {t(
                          s.status === "pending"
                            ? "statusPending"
                            : s.status === "running"
                              ? "statusRunning"
                              : s.status === "completed"
                                ? "statusCompleted"
                                : "statusFailed",
                        )}
                      </Badge>
                    </div>
                    {s.conversation.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(s.id)}
                      >
                        {expanded.has(s.id)
                          ? t("hideTranscript")
                          : t("showTranscript")}
                      </Button>
                    )}
                  </div>

                  {/* Extraction summary */}
                  {s.status === "completed" && (
                    <div className="border-t border-neutral-100 px-3 py-2.5">
                      <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                        {t("extractionTitle")}
                      </div>
                      {s.insightSummary && (
                        <p className="mt-1 text-small text-neutral-700">
                          {s.insightSummary}
                        </p>
                      )}
                      <div className="mt-1.5 text-small text-neutral-500">
                        {t("findingsCount", { count: s.findingCount })}
                      </div>
                    </div>
                  )}

                  {s.status === "failed" && s.error && (
                    <div className="border-t border-neutral-100 px-3 py-2.5 text-small text-danger-700">
                      {s.error}
                    </div>
                  )}

                  {/* Transcript */}
                  {expanded.has(s.id) && (
                    <div className="space-y-2.5 border-t border-neutral-100 bg-neutral-50/60 px-3 py-3">
                      {s.conversation.length === 0 ? (
                        <p className="text-small text-neutral-400">
                          {t("noTranscript")}
                        </p>
                      ) : (
                        s.conversation.map((turn, ti) => (
                          <div key={ti} className="text-small">
                            <span
                              className={`mr-1.5 font-medium ${
                                turn.role === "agent"
                                  ? "text-primary-700"
                                  : "text-neutral-900"
                              }`}
                            >
                              {turn.role === "agent"
                                ? t("interviewerLabel")
                                : t("participantLabel")}
                              :
                            </span>
                            <span className="text-neutral-700">{turn.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* ── Test synthesis ── */}
      {run && (run.synthesis || settled) && (
        <Card>
          <CardHeader>
            <h2 className="text-h3 text-neutral-900">{t("synthesisTitle")}</h2>
            <p className="mt-1 text-small text-neutral-500">
              {t("synthesisDesc")}
            </p>
          </CardHeader>
          <CardBody className="space-y-5">
            {run.synthesis ? (
              <>
                <div>
                  <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                    {t("overviewLabel")}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-body text-neutral-700">
                    {run.synthesis.overview}
                  </p>
                </div>

                <div>
                  <div className="mb-2 text-caption font-medium uppercase tracking-wider text-neutral-400">
                    {t("themesLabel")}
                  </div>
                  {run.synthesis.emergent_themes.length === 0 ? (
                    <p className="text-small text-neutral-400">
                      {t("noThemes")}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {run.synthesis.emergent_themes.map((theme, i) => (
                        <li
                          key={i}
                          className="rounded-md border border-neutral-200 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-body-strong text-neutral-900">
                              {theme.title}
                            </span>
                            <Badge variant="low">
                              {t("frequencyLabel", { count: theme.frequency })}
                            </Badge>
                          </div>
                          <p className="mt-1 text-small text-neutral-700">
                            {theme.summary}
                          </p>
                          {theme.quotes.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {theme.quotes.map((q, qi) => (
                                <li
                                  key={qi}
                                  className="border-l-2 border-neutral-200 pl-2.5 text-small italic text-neutral-600"
                                >
                                  “{q}”
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="mt-2 text-caption text-neutral-400">
                            {t("sourcesLabel")}:{" "}
                            {theme.sourceInsightIds
                              .map((id) => labelById.get(id) ?? id)
                              .join(", ")}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="mb-2 text-caption font-medium uppercase tracking-wider text-neutral-400">
                    {t("tensionsLabel")}
                  </div>
                  {run.synthesis.tensions.length === 0 ? (
                    <p className="text-small text-neutral-400">
                      {t("noTensions")}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {run.synthesis.tensions.map((tension, i) => (
                        <li
                          key={i}
                          className="rounded-md border border-neutral-200 p-3"
                        >
                          <p className="text-small text-neutral-700">
                            {tension.description}
                          </p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {[tension.side_a, tension.side_b].map((side, si) => (
                              <div
                                key={si}
                                className="rounded-md bg-neutral-50 p-2.5"
                              >
                                <div className="text-body-strong text-neutral-900">
                                  {side.label}
                                </div>
                                <div className="mt-1 text-caption text-neutral-400">
                                  {side.sourceInsightIds
                                    .map((id) => labelById.get(id) ?? id)
                                    .join(", ")}
                                </div>
                              </div>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : run.error === "no_successful_interviews" ? (
              <p className="text-small text-neutral-500">{t("noSynthesis")}</p>
            ) : (
              <p className="text-small text-neutral-500">
                {t("synthesisPending")}
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {/* Error box */}
      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}

      {/* Footer actions */}
      {run && (
        <div className="flex flex-wrap items-center gap-3">
          {resumable && (
            <Button
              type="button"
              onClick={() => driveToCompletion(run)}
              disabled={running}
            >
              {running ? t("running") : t("resume")}
            </Button>
          )}
          {settled && (
            <Button type="button" variant="secondary" onClick={startNew}>
              {t("startNew")}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            disabled={deleting || running}
          >
            {deleting ? t("deleting") : t("deleteRun")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Prominent, hard-to-miss warning that synthetic participants are only a guide
 *  test and not real market opinion. Warning-tinted, bold title, icon. */
function Disclaimer({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-warning-500/40 bg-warning-50 p-4">
      <svg
        className="mt-0.5 h-5 w-5 shrink-0 text-warning-700"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      <div>
        <div className="text-body-strong text-warning-700">{title}</div>
        <p className="mt-1 text-small text-warning-700/90">{body}</p>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { FIELD_INPUT_CLASS, FIELD_TEXTAREA_CLASS } from "@/components/ui/Field";
import {
  extractVideoFrames,
  VideoDecodeError,
} from "@/lib/research/extract-video-frames";

/**
 * StimulusUploader — echter Material-Upload (Bild/Video/Link) + KI-Analyse für
 * Creative-/Konzepttest im gefuehrten Wizard. Spiegelt die bewährte Pipeline der
 * klassischen ResearchPlanForm 1:1: Asset geht über die /stimuli-Routen an den
 * Draft-Plan, die KI-Vision-Analyse läuft SYNCHRON im Upload-Request, und der
 * Interviewer-Agent bezieht das analysierte Material später im Gespräch ein.
 *
 * Braucht eine plan-id: ruft beim ersten Upload `ensureDraftPlanId()` des
 * Orchestrators auf (legt den Draft an, falls noch keiner existiert). Alle i18n
 * kommen aus `research.plans` (gleiche Keys wie die klassische Form).
 */

const STIMULUS_MAX_BYTES = 4 * 1024 * 1024; // 4 MB (Bild reist durch die Route)
const STIMULUS_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const STIMULUS_VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB (Signed-Upload)
const STIMULUS_VIDEO_TYPE = "video/mp4";
const STIMULUS_MAX_COUNT = 5;

type StimulusAnalysisStatus = "pending" | "done" | "failed";

export type StimulusItem = {
  id: string;
  position: number;
  type: string;
  url: string;
  label: string | null;
  description: string | null;
  analysisStatus: StimulusAnalysisStatus | null;
  legacy: boolean;
};

function coerceAnalysisStatus(raw: unknown): StimulusAnalysisStatus | null {
  return raw === "pending" || raw === "done" || raw === "failed" ? raw : null;
}

function coerceStimulusItem(raw: unknown): StimulusItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.url !== "string") return null;
  return {
    id: r.id,
    position: typeof r.position === "number" ? r.position : 0,
    type: typeof r.stimulus_type === "string" ? r.stimulus_type : "link",
    url: r.url,
    label: typeof r.label === "string" && r.label !== "" ? r.label : null,
    description:
      typeof r.description === "string" && r.description !== ""
        ? r.description
        : null,
    analysisStatus: coerceAnalysisStatus(r.analysis_status),
    legacy: r.legacy === true,
  };
}

function coerceStimulusItems(raw: unknown): StimulusItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(coerceStimulusItem)
    .filter((item): item is StimulusItem => item !== null);
}

export function StimulusUploader({
  planId,
  ensureDraftPlanId,
  stimuli,
  setStimuli,
}: {
  planId: string | null;
  ensureDraftPlanId: () => Promise<string>;
  stimuli: StimulusItem[];
  setStimuli: React.Dispatch<React.SetStateAction<StimulusItem[]>>;
}) {
  const t = useTranslations("research.plans");
  const [mode, setMode] = useState<"image" | "link">("image");
  const [linkDraft, setLinkDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refreshStimuli(id: string): Promise<void> {
    const res = await fetch(`/api/research/plans/${encodeURIComponent(id)}/stimuli`);
    const data = (await res.json().catch(() => ({}))) as { stimuli?: unknown };
    if (!res.ok) return;
    setStimuli(coerceStimulusItems(data.stimuli));
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const clearInput = () => {
      if (fileRef.current) fileRef.current.value = "";
    };

    const isVideo = file.type === STIMULUS_VIDEO_TYPE;
    if (!isVideo && !STIMULUS_ACCEPTED_TYPES.includes(file.type)) {
      setError(t("errStimulusType"));
      clearInput();
      return;
    }
    if (file.size > (isVideo ? STIMULUS_VIDEO_MAX_BYTES : STIMULUS_MAX_BYTES)) {
      setError(t(isVideo ? "errStimulusVideoSize" : "errStimulusSize"));
      clearInput();
      return;
    }
    if (stimuli.length >= STIMULUS_MAX_COUNT) {
      setError(t("stimulusSetFull"));
      clearInput();
      return;
    }

    setBusy(true);
    try {
      let res: Response;
      if (isVideo) {
        // Frames zuerst — ein nicht dekodierbares Video scheitert hier, bevor
        // irgendetwas den Server erreicht.
        const frames = await extractVideoFrames(file);
        const id = await ensureDraftPlanId();
        const urlRes = await fetch(
          `/api/research/plans/${encodeURIComponent(id)}/stimulus/upload-url`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contentType: STIMULUS_VIDEO_TYPE,
              sizeBytes: file.size,
            }),
          },
        );
        const urlData = (await urlRes.json().catch(() => ({}))) as {
          path?: string;
          signed_url?: string;
          error?: string;
        };
        if (!urlRes.ok || !urlData.path || !urlData.signed_url) {
          throw new Error(urlData.error ?? t("errStimulusUpload"));
        }
        const putRes = await fetch(urlData.signed_url, {
          method: "PUT",
          headers: { "Content-Type": STIMULUS_VIDEO_TYPE, "x-upsert": "false" },
          body: file,
        });
        if (!putRes.ok) throw new Error(t("errStimulusUpload"));
        res = await fetch(`/api/research/plans/${encodeURIComponent(id)}/stimuli`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath: urlData.path, frames }),
        });
      } else {
        const id = await ensureDraftPlanId();
        const body = new FormData();
        body.append("file", file);
        res = await fetch(`/api/research/plans/${encodeURIComponent(id)}/stimuli`, {
          method: "POST",
          body,
        });
      }
      const data = (await res.json().catch(() => ({}))) as {
        stimulus?: unknown;
        error?: string;
      };
      if (!res.ok || !data.stimulus) {
        throw new Error(data.error ?? t("errStimulusUpload"));
      }
      await refreshStimuli(await ensureDraftPlanId());
    } catch (err) {
      setError(
        err instanceof VideoDecodeError
          ? t("errStimulusVideoFormat")
          : err instanceof Error
            ? err.message
            : t("errStimulusUpload"),
      );
    } finally {
      setBusy(false);
      clearInput();
    }
  }

  async function handleLink() {
    setError(null);
    let normalized: string;
    try {
      const url = new URL(linkDraft.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("scheme");
      normalized = url.toString();
    } catch {
      setError(t("errStimulusUrl"));
      return;
    }
    if (stimuli.length >= STIMULUS_MAX_COUNT) {
      setError(t("stimulusSetFull"));
      return;
    }
    setBusy(true);
    try {
      const id = await ensureDraftPlanId();
      const res = await fetch(`/api/research/plans/${encodeURIComponent(id)}/stimuli`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        stimulus?: unknown;
        error?: string;
      };
      if (!res.ok || !data.stimulus) throw new Error(data.error ?? t("errStimulusUpload"));
      await refreshStimuli(id);
      setLinkDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errStimulusUpload"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(item: StimulusItem) {
    setError(null);
    if (!planId) return;
    setBusy(true);
    try {
      const res = await fetch(
        item.legacy
          ? `/api/research/plans/${encodeURIComponent(planId)}/stimulus`
          : `/api/research/plans/${encodeURIComponent(planId)}/stimuli/${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(t("errStimulusRemove"));
      await refreshStimuli(planId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errStimulusRemove"));
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(item: StimulusItem, direction: -1 | 1) {
    if (!planId || item.legacy) return;
    const index = stimuli.findIndex((entry) => entry.id === item.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= stimuli.length) return;
    const orderedIds = stimuli.map((entry) => entry.id);
    [orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]];
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/research/plans/${encodeURIComponent(planId)}/stimuli`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      const data = (await res.json().catch(() => ({}))) as { stimuli?: unknown };
      if (!res.ok) throw new Error(t("errStimulusSave"));
      setStimuli(coerceStimulusItems(data.stimuli));
    } catch {
      setError(t("errStimulusSave"));
      void refreshStimuli(planId);
    } finally {
      setBusy(false);
    }
  }

  function updateField(id: string, field: "label" | "description", value: string) {
    setStimuli((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, [field]: value === "" ? null : value } : entry,
      ),
    );
  }

  async function commitText(id: string) {
    if (!planId) return;
    const item = stimuli.find((entry) => entry.id === id);
    if (!item || item.legacy) return;
    try {
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(planId)}/stimuli/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: item.label ?? null, description: item.description ?? null }),
        },
      );
      if (!res.ok) throw new Error(t("errStimulusSave"));
    } catch {
      setError(t("errStimulusSave"));
    }
  }

  return (
    <div className="mt-3">
      {stimuli.length > 1 ? (
        <p className="mb-2 text-caption text-neutral-500">{t("stimulusOrderHint")}</p>
      ) : null}

      {stimuli.length > 0 ? (
        <ul className="space-y-2">
          {stimuli.map((item, index) => (
            <li key={item.id} className="rounded-md border border-neutral-200 bg-card p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-caption font-semibold text-neutral-600">
                  {index + 1}
                </span>
                {item.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={t("stimulusThumbAlt")}
                    className="h-14 w-14 shrink-0 rounded-md border border-neutral-200 bg-card object-contain p-1"
                  />
                ) : item.type === "video" ? (
                  <video
                    src={item.url}
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={t("stimulusThumbAlt")}
                    className="h-14 w-14 shrink-0 rounded-md border border-neutral-200 bg-card object-contain p-1"
                  />
                ) : (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate text-small text-primary-700 underline underline-offset-2 hover:text-primary-800"
                  >
                    {item.url}
                  </a>
                )}
                <span className="shrink-0 rounded-full bg-neutral-200 px-2 py-0.5 text-caption font-medium leading-none text-neutral-600">
                  {item.type === "image"
                    ? t("stimulusModeImage")
                    : item.type === "video"
                      ? t("stimulusModeVideo")
                      : t("stimulusModeLink")}
                </span>
                {item.analysisStatus === "pending" ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-caption text-neutral-500">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
                      aria-hidden="true"
                    />
                    {t("stimulusAnalysisPending")}
                  </span>
                ) : null}
                {item.analysisStatus === "done" ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-caption font-medium text-success-700">
                    <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12 5 5L20 7" />
                    </svg>
                    {t("stimulusAnalysisDone")}
                  </span>
                ) : null}
                {item.analysisStatus === "failed" ? (
                  <span className="shrink-0 text-caption text-neutral-500">{t("stimulusAnalysisFailed")}</span>
                ) : null}
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMove(item, -1)}
                    disabled={busy || index === 0 || item.legacy}
                    aria-label={t("stimulusMoveUp")}
                    title={t("stimulusMoveUp")}
                    className="rounded-md border border-neutral-200 bg-card px-2 py-1 text-small text-neutral-700 hover:border-neutral-300 disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(item, 1)}
                    disabled={busy || index === stimuli.length - 1 || item.legacy}
                    aria-label={t("stimulusMoveDown")}
                    title={t("stimulusMoveDown")}
                    className="rounded-md border border-neutral-200 bg-card px-2 py-1 text-small text-neutral-700 hover:border-neutral-300 disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(item)}
                    disabled={busy}
                    className="rounded-md border border-neutral-200 bg-card px-2.5 py-1 text-small text-neutral-700 hover:border-neutral-300 disabled:opacity-50"
                  >
                    {t("stimulusRemove")}
                  </button>
                </div>
              </div>

              {!item.legacy ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-[200px_1fr]">
                  <input
                    type="text"
                    value={item.label ?? ""}
                    onChange={(e) => updateField(item.id, "label", e.target.value)}
                    onBlur={() => void commitText(item.id)}
                    placeholder={t("phStimulusLabel")}
                    aria-label={t("stimulusLabelLabel")}
                    maxLength={80}
                    className={FIELD_INPUT_CLASS}
                  />
                  <textarea
                    value={item.description ?? ""}
                    onChange={(e) => updateField(item.id, "description", e.target.value)}
                    onBlur={() => void commitText(item.id)}
                    placeholder={t("phStimulusDesc")}
                    aria-label={t("stimulusDescLabel")}
                    rows={2}
                    maxLength={3000}
                    className={FIELD_TEXTAREA_CLASS}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {stimuli.length >= STIMULUS_MAX_COUNT ? (
        <p className="mt-3 text-caption text-neutral-500">{t("stimulusSetFull")}</p>
      ) : (
        <>
          <div
            role="radiogroup"
            aria-label={t("stimulusSectionTitle")}
            className="mt-3 inline-flex items-center gap-0.5 rounded-full bg-neutral-100 p-0.5"
          >
            {(["image", "link"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                disabled={busy}
                className={`rounded-full px-3.5 py-1.5 text-small font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-60 ${
                  mode === m ? "bg-primary-600 text-white" : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {m === "image" ? t("stimulusModeUpload") : t("stimulusModeLink")}
              </button>
            ))}
          </div>

          {mode === "image" ? (
            <div className="mt-3">
              <label
                className={`inline-flex items-center rounded-md border border-neutral-200 px-3 py-2 text-body-strong text-neutral-700 ${
                  busy ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                }`}
              >
                {busy ? t("stimulusImageUploading") : t("stimulusImageUpload")}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,video/mp4"
                  disabled={busy}
                  onChange={handleFile}
                  className="sr-only"
                />
              </label>
              <p className="mt-1.5 text-caption text-neutral-500">{t("stimulusImageHint")}</p>
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <input
                    type="url"
                    value={linkDraft}
                    onChange={(e) => setLinkDraft(e.target.value)}
                    placeholder={t("phStimulusLink")}
                    aria-label={t("stimulusLinkLabel")}
                    disabled={busy}
                    className={FIELD_INPUT_CLASS}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleLink}
                  disabled={busy || linkDraft.trim() === ""}
                >
                  {busy ? t("stimulusLinkSetting") : t("stimulusLinkSet")}
                </Button>
              </div>
              <p className="mt-1.5 text-caption text-neutral-500">{t("stimulusLinkHint")}</p>
            </div>
          )}
        </>
      )}

      {stimuli.length === 0 ? (
        <p className="mt-3 rounded-md border border-warning-500/30 bg-warning-50 px-3 py-2 text-caption text-warning-700">
          {t("stimulusRequiredHint")}
        </p>
      ) : null}

      {error ? <p className="mt-2 text-small text-danger-700">{error}</p> : null}
    </div>
  );
}

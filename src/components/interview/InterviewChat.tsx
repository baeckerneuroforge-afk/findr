"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { InterviewTurn } from "@/lib/voice-agent/interviewer";

type Status = "open" | "completed" | "abandoned";

interface SessionView {
  status: Status;
  conversation: InterviewTurn[];
  company: string | null;
}

interface InterviewChatProps {
  token: string;
  initialConversation: InterviewTurn[];
  initialStatus: Status;
  company: string | null;
  /** Drop Findr branding from the chrome — used by the research flow where
   *  the participant is the customer of a Findr customer and has no
   *  relationship with Findr. When true:
   *    - the "findr." wordmark in the top bar is hidden,
   *    - the bottom-of-input caption replaces "Powered by findr. · …"
   *      with a neutral "Confidential research interview." line.
   *  Defaults to false so post_loss / checkin renders unchanged. */
  brandless?: boolean;
  /** When set, used as the h1 in place of the default
   *  "A short conversation [about ${company}]". The research page passes
   *  the research-plan title here; if absent it falls back to a generic
   *  "Research interview". For post_loss / checkin this stays null and the
   *  original company-aware heading is rendered. */
  headingOverride?: string | null;
  /** White-label (research only). When a Findr customer has set branding, the
   *  brandless research header shows their logo/name instead of staying empty,
   *  and the accent color overrides the default violet. All null → byte-
   *  identical neutral fallback (today's behavior). */
  brandName?: string | null;
  /** #RRGGBB accent; null → default Findr violet (#5B2FD4). */
  accentColor?: string | null;
  /** Public logo URL; null → fall back to the text brand name (or nothing). */
  logoUrl?: string | null;
  /** Panel-Anbieter E2: die fertig aufgebaute Complete-Return-URL des Anbieters.
   *  Wenn gesetzt (nur Panel-Sessions), leitet CompletedPanel den Browser dorthin
   *  zurück, sobald das Interview abgeschlossen ist. Null für JEDE Nicht-Panel-
   *  Session → der bestehende Dank-Screen, KEIN Redirect (byte-identisch). */
  panelCompleteRedirect?: string | null;
  /** Visual Intelligence E1: optional browser-side screen capture for research
   *  interviews. Defaults false so post_loss/checkin and unsupported browsers
   *  render the existing chat path unchanged. */
  visualCaptureEnabled?: boolean;
}

/** Default Findr accent — fallback when no org accent color is set. */
const DEFAULT_ACCENT = "#5B2FD4";
/** Only ever apply a caller-supplied accent if it's a strict #RRGGBB hex. */
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const FONT = "var(--font-inter), Inter, system-ui, -apple-system, sans-serif";

const VISUAL_SAMPLE_EVERY_SECONDS = 8;
const VISUAL_SAMPLE_EVERY_MS = VISUAL_SAMPLE_EVERY_SECONDS * 1000;
const VISUAL_MAX_FRAMES = 24;
const VISUAL_MAX_DIMENSION = 960;
const VISUAL_JPEG_QUALITY = 0.62;

type VisualCaptureState =
  | "unsupported"
  | "prompt"
  | "starting"
  | "recording"
  | "stopped"
  | "truncated"
  | "declined";

interface CapturedVisualFrame {
  index: number;
  timestampSeconds: number;
  mediaType: "image/jpeg";
  data: string;
}

function isLikelyMobileDevice(): boolean {
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

function canCaptureDisplay(): boolean {
  return Boolean(
    window.isSecureContext &&
      typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
      !isLikelyMobileDevice(),
  );
}

function Bubble({ role, text }: { role: InterviewTurn["role"]; text: string }) {
  const isAgent = role === "agent";
  return (
    <div className={`flex ${isAgent ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
          isAgent
            ? "rounded-tl-sm bg-[#F4F1FD] text-[#0E0A1F]"
            : "rounded-tr-sm bg-[var(--brand-accent)] text-white"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-tl-sm bg-[#F4F1FD] px-4 py-3">
        <span className="flex items-center gap-1">
          {["0ms", "150ms", "300ms"].map((d) => (
            <span
              key={d}
              className="inline-block h-[6px] w-[6px] animate-bounce rounded-full bg-[var(--brand-accent)]"
              style={{ animationDelay: d }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

function VisualCapturePanel({
  state,
  frameCount,
  truncated,
  onAccept,
  onDecline,
}: {
  state: VisualCaptureState;
  frameCount: number;
  truncated: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const t = useTranslations("interview");
  if (state === "unsupported" || state === "declined") return null;

  if (state === "prompt" || state === "starting") {
    return (
      <div className="mb-5 rounded-lg border border-[#E8E4F2] bg-[#FAFAFE] px-4 py-4">
        <h2 className="text-[14px] font-semibold text-[#0E0A1F]">
          {t("visualCapture.title")}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6B6680]">
          {t("visualCapture.body")}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-[#8A85A0]">
          <a
            href="/datenschutz"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-[#0E0A1F]"
          >
            {t("visualCapture.privacyLink")}
          </a>
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAccept}
            disabled={state === "starting"}
            className="h-[40px] rounded-lg bg-[var(--brand-accent)] px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {state === "starting"
              ? t("visualCapture.starting")
              : t("visualCapture.accept")}
          </button>
          <button
            type="button"
            onClick={onDecline}
            disabled={state === "starting"}
            className="h-[40px] rounded-lg border border-[#D9D4E8] bg-white px-4 text-[13px] font-medium text-[#0E0A1F] transition-colors hover:bg-[#F4F1FD] disabled:opacity-50"
          >
            {t("visualCapture.decline")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 flex items-start gap-3 rounded-lg border border-[#E8E4F2] bg-white px-4 py-3 text-[13px] leading-relaxed text-[#6B6680]">
      <span
        className={`mt-[6px] h-2 w-2 shrink-0 rounded-full ${
          state === "recording" ? "bg-[#2E9E6B]" : "bg-[#B7B0CC]"
        }`}
        aria-hidden="true"
      />
      <span>
        {state === "recording"
          ? t("visualCapture.recording", { count: frameCount })
          : truncated || state === "truncated"
            ? t("visualCapture.truncated")
            : t("visualCapture.stopped", { count: frameCount })}
      </span>
    </div>
  );
}

function CompletedPanel({
  redirectUrl = null,
}: {
  /** Panel-Anbieter E2: wenn gesetzt, wird der Teilnehmer beim Mount (= Interview
   *  abgeschlossen) zur Anbieter-Complete-URL zurückgeleitet. Der Dank-Screen ist
   *  dann nur ein kurzer Fallback (z. B. falls die Navigation scheitert). Null →
   *  reiner Dank-Screen, byte-identisch zu heute. */
  redirectUrl?: string | null;
}) {
  const t = useTranslations("interview");
  useEffect(() => {
    if (redirectUrl) window.location.href = redirectUrl;
  }, [redirectUrl]);
  return (
    <div className="mb-10 mt-8 rounded-2xl border border-[#E8E4F2] bg-[#FAFAFE] px-6 py-8 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#2E9E6B] text-[18px] text-white">
        ✓
      </div>
      <h2 className="text-[18px] font-semibold text-[#0E0A1F]">
        {t("completed.title")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[#6B6680]">
        {t("completed.body")}
      </p>
    </div>
  );
}

export function InterviewChat({
  token,
  initialConversation,
  initialStatus,
  company,
  brandless = false,
  headingOverride = null,
  brandName = null,
  accentColor = null,
  logoUrl = null,
  panelCompleteRedirect = null,
  visualCaptureEnabled = false,
}: InterviewChatProps) {
  const t = useTranslations("interview");
  const locale = useLocale();

  // Accent flows down as a CSS custom property on the root wrapper; the inline
  // bg-[var(--brand-accent)] utilities (incl. the module-level Bubble /
  // TypingBubble) read it via the cascade. Guarded to strict hex so a bad value
  // can never inject into the style attribute.
  const accent =
    accentColor && HEX_COLOR.test(accentColor) ? accentColor : DEFAULT_ACCENT;
  // White-label brand chrome only applies to the brandless (research) surface.
  const hasBrand = brandless && Boolean(logoUrl || brandName);
  const [messages, setMessages] = useState<InterviewTurn[]>(initialConversation);
  const [status, setStatus] = useState<Status>(initialStatus);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visualCaptureState, setVisualCaptureState] =
    useState<VisualCaptureState>("unsupported");
  const [visualFrameCount, setVisualFrameCount] = useState(0);
  const [visualTruncated, setVisualTruncated] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const visualStreamRef = useRef<MediaStream | null>(null);
  const visualVideoRef = useRef<HTMLVideoElement | null>(null);
  const visualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualTimerRef = useRef<number | null>(null);
  const visualStartedAtRef = useRef<number | null>(null);
  const visualFramesRef = useRef<CapturedVisualFrame[]>([]);
  const visualSubmittedRef = useRef(false);
  const visualTruncatedRef = useRef(false);

  const isOpen = status === "open";
  const visualConsentPending =
    isOpen &&
    visualCaptureEnabled &&
    (visualCaptureState === "prompt" || visualCaptureState === "starting");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!visualCaptureEnabled || !isOpen) return;
    if (!canCaptureDisplay()) return;
    setVisualCaptureState((current) =>
      current === "unsupported" ? "prompt" : current,
    );
  }, [isOpen, visualCaptureEnabled]);

  useEffect(() => {
    return () => {
      stopVisualCapture();
    };
  }, []);

  function clearVisualTimer() {
    if (visualTimerRef.current !== null) {
      window.clearInterval(visualTimerRef.current);
      visualTimerRef.current = null;
    }
  }

  function stopVisualCapture(nextState?: VisualCaptureState) {
    clearVisualTimer();
    visualStreamRef.current?.getTracks().forEach((track) => track.stop());
    visualStreamRef.current = null;
    if (visualVideoRef.current) {
      visualVideoRef.current.pause();
      visualVideoRef.current.srcObject = null;
    }
    visualVideoRef.current = null;
    if (nextState) setVisualCaptureState(nextState);
  }

  function sampleVisualFrame() {
    const video = visualVideoRef.current;
    if (
      !video ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      return;
    }

    if (visualFramesRef.current.length >= VISUAL_MAX_FRAMES) {
      visualTruncatedRef.current = true;
      setVisualTruncated(true);
      console.info(
        "[visual-capture] frame cap reached; only the first part will be analyzed.",
      );
      stopVisualCapture("truncated");
      return;
    }

    const scale = Math.min(
      1,
      VISUAL_MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight),
    );
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas =
      visualCanvasRef.current ?? document.createElement("canvas");
    visualCanvasRef.current = canvas;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(video, 0, 0, width, height);

    const startedAt = visualStartedAtRef.current ?? Date.now();
    const frame: CapturedVisualFrame = {
      index: visualFramesRef.current.length,
      timestampSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
      mediaType: "image/jpeg",
      data: canvas.toDataURL("image/jpeg", VISUAL_JPEG_QUALITY),
    };
    visualFramesRef.current.push(frame);
    setVisualFrameCount(visualFramesRef.current.length);

    if (visualFramesRef.current.length >= VISUAL_MAX_FRAMES) {
      visualTruncatedRef.current = true;
      setVisualTruncated(true);
      console.info(
        "[visual-capture] frame cap reached; only the first part will be analyzed.",
      );
      stopVisualCapture("truncated");
    }
  }

  async function startVisualCapture() {
    if (!canCaptureDisplay()) {
      setVisualCaptureState("unsupported");
      return;
    }

    setVisualCaptureState("starting");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      visualStreamRef.current = stream;
      visualStartedAtRef.current = Date.now();
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      visualVideoRef.current = video;

      const [track] = stream.getVideoTracks();
      track?.addEventListener(
        "ended",
        () => {
          stopVisualCapture("stopped");
        },
        { once: true },
      );

      await video.play();
      setVisualCaptureState("recording");
      sampleVisualFrame();
      visualTimerRef.current = window.setInterval(
        sampleVisualFrame,
        VISUAL_SAMPLE_EVERY_MS,
      );
    } catch (err) {
      console.info(
        "[visual-capture] screen capture was not started:",
        err instanceof Error ? err.message : err,
      );
      stopVisualCapture("declined");
    }
  }

  function declineVisualCapture() {
    visualFramesRef.current = [];
    setVisualFrameCount(0);
    stopVisualCapture("declined");
  }

  async function submitVisualCapture() {
    if (!visualCaptureEnabled || visualSubmittedRef.current) return;
    visualSubmittedRef.current = true;
    const frames = visualFramesRef.current.slice(0, VISUAL_MAX_FRAMES);
    const truncated =
      visualTruncatedRef.current ||
      visualTruncated ||
      visualFramesRef.current.length > VISUAL_MAX_FRAMES;
    stopVisualCapture(truncated ? "truncated" : "stopped");
    if (frames.length === 0) return;

    try {
      const res = await fetch(`/api/interview/${token}/visual-capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sampledEverySeconds: VISUAL_SAMPLE_EVERY_SECONDS,
          truncated,
          frames,
        }),
      });
      if (!res.ok) {
        console.info("[visual-capture] processing failed:", res.status);
      }
    } catch (err) {
      console.info(
        "[visual-capture] processing request failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || !isOpen || visualConsentPending) return;

    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "customer", text }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/interview/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? t("error.requestFailed"));
      }
      const data = (await res.json()) as { session: SessionView };
      if (data.session.status === "completed") {
        void submitVisualCapture();
      }
      setMessages(data.session.conversation);
      setStatus(data.session.status);
    } catch (err) {
      // Roll back the optimistic message and let the buyer resend.
      setMessages((prev) =>
        prev.filter(
          (m, i) =>
            !(i === prev.length - 1 && m.role === "customer" && m.text === text),
        ),
      );
      setInput(text);
      setError(err instanceof Error ? err.message : t("error.generic"));
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div
      lang={locale}
      style={{ fontFamily: FONT, "--brand-accent": accent } as React.CSSProperties}
      className="flex min-h-screen w-full flex-col bg-white text-[#0E0A1F]"
    >
      <header className="border-b border-[#E8E4F2] px-5 py-4">
        <div
          className={`mx-auto flex max-w-2xl items-center ${
            brandless && !hasBrand ? "justify-center" : "justify-between"
          }`}
        >
          {!brandless && (
            <span className="flex items-center text-[20px] font-extrabold tracking-[-0.02em] text-[#0E0A1F]">
              findr
              <span className="mb-[10px] ml-[1px] inline-block h-[4px] w-[4px] rounded-full bg-[#B00]" />
            </span>
          )}
          {hasBrand &&
            (logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={brandName ?? ""}
                className="h-7 w-auto max-w-[180px] object-contain"
              />
            ) : (
              <span className="text-[20px] font-extrabold tracking-[-0.02em] text-[#0E0A1F]">
                {brandName}
              </span>
            ))}
          <span className="text-[12px] text-[#6B6680]">
            {t("header.confidential")}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-6">
        <div className="mb-6">
          <h1 className="text-[18px] font-semibold">
            {headingOverride
              ? headingOverride
              : brandless
                ? t("header.titleResearch")
                : company
                  ? t("header.titleWithCompany", { company })
                  : t("header.title")}
          </h1>
          <p className="mt-1 text-[14px] leading-relaxed text-[#6B6680]">
            {t("header.subtitle")}
          </p>
        </div>

        <div className="flex-1 space-y-4">
          <VisualCapturePanel
            state={visualCaptureState}
            frameCount={visualFrameCount}
            truncated={visualTruncated}
            onAccept={() => void startVisualCapture()}
            onDecline={declineVisualCapture}
          />
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.text} />
          ))}
          {loading && <TypingBubble />}
          <div ref={endRef} />
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-[#FFD7D0] bg-[#FFF3F1] px-4 py-2 text-[13px] text-[#C9442F]">
            {error}
          </div>
        )}

        {isOpen ? (
          <div className="sticky bottom-0 mt-6 bg-white pb-6 pt-2">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={loading || visualConsentPending}
                rows={1}
                placeholder={t("input.placeholder")}
                className="max-h-40 min-h-[46px] flex-1 resize-none rounded-xl border border-[#E8E4F2] px-4 py-3 text-[15px] outline-none transition-colors focus:border-[var(--brand-accent)] disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={loading || visualConsentPending || !input.trim()}
                className={`h-[46px] shrink-0 rounded-xl bg-[var(--brand-accent)] px-5 text-[14px] font-medium text-white disabled:opacity-50 ${
                  accent === DEFAULT_ACCENT
                    ? "transition-colors hover:bg-[#4A22B0]"
                    : "transition-opacity hover:opacity-90"
                }`}
              >
                {loading ? "…" : t("input.send")}
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-[#9B9BA3]">
              {brandless ? t("footer.brandless") : t("footer.default")}
            </p>
          </div>
        ) : (
          <CompletedPanel redirectUrl={panelCompleteRedirect} />
        )}
      </main>
    </div>
  );
}

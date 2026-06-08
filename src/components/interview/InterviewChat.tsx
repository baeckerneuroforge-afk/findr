"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  /** #RRGGBB accent; null → default Findr violet (#4A51A8). */
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
  /** Voice Stage 1: when true, an additive push-to-talk mic surface is shown
   *  alongside the textarea. The recorded audio goes to /api/interview/[token]/
   *  voice, which transcribes it and returns the same { session } shape as the
   *  typed path. Defaults false → byte-identical text-only chat. Typing always
   *  stays available as the fallback. */
  voiceEnabled?: boolean;
  /** Stimulus E4: the single asset the participant reacts to, shown in a
   *  split-view beside the chat. `stimulusUrl` is a public image URL (our
   *  bucket) when `stimulusType` is "image", or an external prototype URL when
   *  "link". Both null (non-research / no stimulus) → the existing single-column
   *  layout renders unchanged. `stimulus_description` is deliberately NOT passed:
   *  it's interviewer-prompt-only and must never be shown to the participant. */
  stimulusUrl?: string | null;
  stimulusType?: string | null;
}

/** Default Findr accent — fallback when no org accent color is set. */
const DEFAULT_ACCENT = "#4A51A8";
/** Only ever apply a caller-supplied accent if it's a strict #RRGGBB hex. */
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const FONT = "var(--font-inter), Inter, system-ui, -apple-system, sans-serif";

const VISUAL_SAMPLE_EVERY_SECONDS = 8;
const VISUAL_SAMPLE_EVERY_MS = VISUAL_SAMPLE_EVERY_SECONDS * 1000;
const VISUAL_MAX_FRAMES = 24;
const VISUAL_MAX_DIMENSION = 960;
const VISUAL_JPEG_QUALITY = 0.62;

// Push-to-talk soft cap. Deepgram + the /voice route allow far more, but a short
// per-turn cap keeps each answer snappy and the upload well under the route's
// 10 MB limit. On reaching it the recording auto-stops and sends.
const VOICE_MAX_RECORDING_SECONDS = 120;

type VisualCaptureState =
  | "unsupported"
  | "prompt"
  | "starting"
  | "recording"
  | "stopped"
  | "truncated"
  | "declined";

// "init" is the SSR/pre-check state and renders nothing (mirrors how the visual
// panel stays silent until the browser is probed in an effect — no hydration
// mismatch, no flash). The effect then resolves to "idle" (mic ready) or
// "unsupported" (no mic / insecure context → type instead). "denied" = the user
// rejected the getUserMedia permission.
type VoiceState =
  | "init"
  | "idle"
  | "recording"
  | "sending"
  | "denied"
  | "unsupported";

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

/** Push-to-talk needs a secure context, getUserMedia, and MediaRecorder. Mobile
 *  is fine for audio (unlike screen capture). When unsupported the participant
 *  simply types — the text path is always present. */
function canRecordAudio(): boolean {
  return Boolean(
    window.isSecureContext &&
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof window.MediaRecorder !== "undefined",
  );
}

/** First container/codec MediaRecorder reports as supported, or undefined to let
 *  the browser choose its default. The /voice route forwards whatever
 *  Content-Type we send to Deepgram, which auto-detects the container. */
function pickAudioMimeType(): string | undefined {
  if (
    typeof window.MediaRecorder === "undefined" ||
    typeof MediaRecorder.isTypeSupported !== "function"
  ) {
    return undefined;
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

/** "m:ss" elapsed-time label for the recording indicator. */
function formatRecordingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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

/**
 * The stimulus asset shown beside the chat (split-view). Image → a contained
 * <img> (bucket URL, scaled, framed); link → a card with an outbound "open
 * prototype" button (NO iframe — foreign prototypes routinely block framing and
 * it's a security risk; a clean new-tab link is safer). The `stimulus_description`
 * is interviewer-only and never rendered here.
 */
function StimulusPanel({ url, kind }: { url: string; kind: "image" | "link" }) {
  const t = useTranslations("interview");
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#8A85A0]">
        {t("stimulus.label")}
      </p>
      {kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={t("stimulus.imageAlt")}
          className="max-h-[32vh] w-full rounded-xl border border-[#E8E4F2] bg-[#FAFAFE] object-contain lg:max-h-[80vh]"
        />
      ) : (
        <div className="rounded-xl border border-[#E8E4F2] bg-[#FAFAFE] px-4 py-4">
          <h2 className="text-[14px] font-semibold text-[#0E0A1F]">
            {t("stimulus.linkTitle")}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#6B6680]">
            {t("stimulus.linkBody")}
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-[40px] items-center rounded-lg bg-[var(--brand-accent)] px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          >
            {t("stimulus.openLink")}
          </a>
          <p className="mt-2 text-[12px] text-[#8A85A0]">
            {t("stimulus.newTab")}
          </p>
        </div>
      )}
    </div>
  );
}

function MicIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

/** Small ring spinner for the short "processing" window while the /voice route
 *  transcribes. Spin is gated behind motion-safe — under reduced motion it stays
 *  a calm static ring. */
function Spinner() {
  return (
    <span
      className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
      aria-hidden="true"
    />
  );
}

/** Live prefers-reduced-motion subscription. SSR-safe (server snapshot = false)
 *  via useSyncExternalStore — no hydration mismatch. When set, the voice wave
 *  holds a static silhouette instead of tracking the mic level. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Equalizer-style bars whose amplitude is driven by the LIVE mic RMS (`level`,
 *  0..1) computed in startVoiceLevelMeter from the SAME AnalyserNode that already
 *  existed — no second audio path, no fake/keyframe animation. The static
 *  WAVE_PROFILE only shapes the silhouette; `level` scales it, so louder speech =
 *  taller bars, quieter = shorter. Under prefers-reduced-motion the bars hold a
 *  fixed half-amplitude shape with no level coupling and no transition. */
const WAVE_PROFILE = [0.45, 0.7, 0.95, 1, 0.85, 0.6, 0.4];
const WAVE_MIN_PX = 4;
const WAVE_RANGE_PX = 18;

function VoiceWave({
  level,
  reducedMotion,
}: {
  level: number;
  reducedMotion: boolean;
}) {
  const amplitude = reducedMotion ? 0.5 : Math.min(1, Math.max(0, level));
  return (
    <span className="flex items-center gap-[3px]" aria-hidden="true">
      {WAVE_PROFILE.map((profile, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full bg-white ${
            reducedMotion ? "" : "transition-[height] duration-75 ease-out"
          }`}
          style={{ height: `${WAVE_MIN_PX + profile * amplitude * WAVE_RANGE_PX}px` }}
        />
      ))}
    </span>
  );
}

/** Additive push-to-talk surface for voice-mode studies. Renders nothing in the
 *  pre-check "init" state; a calm "please type" hint when recording is
 *  unsupported or the mic was denied; otherwise the AI-transparency notice plus
 *  the start / stop affordance. The textarea below always remains the fallback. */
function VoiceControls({
  state,
  level,
  seconds,
  disabled,
  onStart,
  onStop,
}: {
  state: VoiceState;
  level: number;
  seconds: number;
  disabled: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const t = useTranslations("interview");
  const reducedMotion = usePrefersReducedMotion();

  if (state === "init") return null;

  if (state === "unsupported" || state === "denied") {
    return (
      <p className="mb-3 rounded-lg border border-[#E8E4F2] bg-[#FAFAFE] px-4 py-2.5 text-[12px] leading-relaxed text-[#6B6680]">
        {state === "unsupported" ? t("voice.unsupported") : t("voice.denied")}
      </p>
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-[#E8E4F2] bg-[#FAFAFE] px-4 py-3">
      <p className="text-[12px] leading-relaxed text-[#6B6680]">
        {t("voice.aiNotice")}
      </p>
      <div className="mt-3">
        {state === "recording" ? (
          // Recording: the mic has morphed into a level-driven wave pill. One
          // click (or Space) stops + sends — the same toggle as starting.
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onStop}
              aria-label={t("voice.stop")}
              className="flex h-[44px] shrink-0 items-center gap-2.5 rounded-full bg-[var(--brand-accent)] pl-3.5 pr-4 text-white transition-opacity hover:opacity-90"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-white motion-safe:animate-pulse"
                aria-hidden="true"
              />
              <VoiceWave level={level} reducedMotion={reducedMotion} />
              <span className="text-[13px] font-medium tabular-nums">
                {formatRecordingTime(seconds)}
              </span>
            </button>
            <span className="text-[12px] leading-snug text-[#6B6680]">
              {t("voice.stopHint")}
            </span>
            <span className="sr-only">
              {t("voice.recording")} · {t("voice.levelLabel")}
            </span>
          </div>
        ) : state === "sending" ? (
          // Processing: short load state while the /voice route transcribes.
          <span className="flex h-[44px] w-fit items-center gap-2.5 rounded-full bg-[#F4F1FD] pl-3.5 pr-4 text-[var(--brand-accent)]">
            <Spinner />
            <span className="text-[13px] font-medium">{t("voice.sending")}</span>
          </span>
        ) : (
          // Idle: round mic. Click it or press Space to start; typing below
          // always stays available as the fallback.
          <div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onStart}
                disabled={disabled}
                aria-label={t("voice.start")}
                className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <MicIcon size={20} />
              </button>
              <div className="leading-tight">
                <span className="block text-[14px] font-medium text-[#0E0A1F]">
                  {t("voice.start")}
                </span>
                <span className="mt-0.5 block text-[12px] text-[#6B6680]">
                  {t("voice.startHint")}
                </span>
              </div>
            </div>
            <p className="mt-2.5 text-[12px] text-[#8A85A0]">
              {t("voice.typeInstead")}
            </p>
          </div>
        )}
      </div>
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
  voiceEnabled = false,
  stimulusUrl = null,
  stimulusType = null,
}: InterviewChatProps) {
  const t = useTranslations("interview");
  const locale = useLocale();

  // Stimulus E4: narrow the two loose props into one typed value. Non-null ONLY
  // when there's a URL AND a recognized type — drives the split-view. Null (the
  // common case) → the existing single-column layout renders byte-identically.
  const stimulusKind: "image" | "link" | null =
    stimulusType === "image" || stimulusType === "link" ? stimulusType : null;
  const stimulus =
    stimulusUrl && stimulusKind
      ? { url: stimulusUrl, kind: stimulusKind }
      : null;

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
  // Voice push-to-talk (additive; all inert unless voiceEnabled). The recorder,
  // stream, chunks and meter live in refs so they survive re-renders; only the
  // display-facing state/level/seconds are React state.
  const [voiceState, setVoiceState] = useState<VoiceState>("init");
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const levelRafRef = useRef<number | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const voiceSecondsRef = useRef(0);
  // Latest-value ref for the Space-bar toggle. The window listener binds once
  // per open voice session; this ref keeps it pointed at the current state +
  // handlers without rebinding on every mic-level tick. Returns whether it acted
  // so the listener only swallows Space (preventDefault) when it actually toggled.
  const voiceToggleRef = useRef<() => boolean>(() => false);

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

  // Voice init: once mounted (so window/navigator exist), resolve the pre-check
  // "init" state to "idle" if the browser can record, else "unsupported". Never
  // overrides an in-flight recording/sending state. Inert when voiceEnabled is
  // false → voiceState stays "init" and no mic UI ever renders.
  useEffect(() => {
    if (!voiceEnabled || !isOpen) return;
    // Resolve ONLY the pre-check "init" state → idle (can record) or unsupported.
    // Never disturb a live recording/sending turn or a settled idle/denied state.
    setVoiceState((current) =>
      current === "init"
        ? canRecordAudio()
          ? "idle"
          : "unsupported"
        : current,
    );
  }, [voiceEnabled, isOpen]);

  useEffect(() => {
    return () => {
      teardownRecording();
    };
  }, []);

  // Keep the Space-bar toggle pointed at the current state + handlers. Runs after
  // every render (no deps) so the window listener below — bound once — always
  // sees fresh closures. Acts only when a turn can actually start/stop.
  useEffect(() => {
    voiceToggleRef.current = () => {
      if (voiceState === "recording") {
        stopRecording();
        return true;
      }
      if (voiceState === "idle") {
        void startRecording();
        return true;
      }
      return false;
    };
  });

  // Space-bar = the SAME start/stop toggle as the mic button — but only when the
  // participant isn't typing. If the textarea (or any field / button / link)
  // holds focus, Space behaves natively (types a space, activates the control)
  // and we never touch it: that's the critical guard against starting a recording
  // mid-sentence. Mobile has no Space; the mic button's onClick covers tap there.
  useEffect(() => {
    if (!voiceEnabled || !isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.code !== "Space" ||
        e.repeat ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.shiftKey
      ) {
        return;
      }
      const el = document.activeElement as HTMLElement | null;
      if (el) {
        const tag = el.tagName;
        if (
          tag === "TEXTAREA" ||
          tag === "INPUT" ||
          tag === "SELECT" ||
          tag === "BUTTON" ||
          tag === "A" ||
          el.isContentEditable
        ) {
          return;
        }
      }
      // Not typing → treat Space as the record toggle. preventDefault only when
      // we actually toggled, so Space still scrolls when voice can't act.
      if (voiceToggleRef.current()) e.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [voiceEnabled, isOpen]);

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

  function clearVoiceTimer() {
    if (voiceTimerRef.current !== null) {
      window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  }

  function startVoiceLevelMeter(stream: MediaStream) {
    // Best-effort live mic meter — purely visual. Any failure leaves the level
    // at 0; recording continues regardless. It never transcribes.
    try {
      if (typeof window.AudioContext === "undefined") return;
      const context = new AudioContext();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
          const deviation = (data[i] - 128) / 128;
          sumSquares += deviation * deviation;
        }
        const rms = Math.sqrt(sumSquares / data.length);
        setVoiceLevel(Math.min(1, rms * 2.4));
        levelRafRef.current = window.requestAnimationFrame(tick);
      };
      levelRafRef.current = window.requestAnimationFrame(tick);
    } catch {
      // Meter unavailable — recording still works without the visualization.
    }
  }

  function stopVoiceLevelMeter() {
    if (levelRafRef.current !== null) {
      window.cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") {
      void context.close().catch(() => {});
    }
    setVoiceLevel(0);
  }

  /** Tears down any in-flight recording WITHOUT sending (unmount + safety net):
   *  detaches the handlers first so onstop can't fire a request after the
   *  component is gone, then stops the recorder and releases the mic. */
  function teardownRecording() {
    clearVoiceTimer();
    stopVoiceLevelMeter();
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // already stopped
      }
    }
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
    audioChunksRef.current = [];
  }

  async function startRecording() {
    if (
      !canRecordAudio() ||
      !isOpen ||
      loading ||
      visualConsentPending ||
      voiceState === "recording" ||
      voiceState === "sending"
    ) {
      return;
    }
    setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Permission denied or no microphone — fall back to typing.
      setVoiceState("denied");
      return;
    }

    audioStreamRef.current = stream;
    audioChunksRef.current = [];
    const mimeType = pickAudioMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      clearVoiceTimer();
      stopVoiceLevelMeter();
      const chunks = audioChunksRef.current;
      audioChunksRef.current = [];
      const fullType = recorder.mimeType || chunks[0]?.type || "audio/webm";
      const blob = new Blob(chunks, { type: fullType });
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
      if (blob.size === 0) {
        setVoiceState("idle");
        return;
      }
      // Send only the container type (e.g. "audio/webm"); Deepgram detects the
      // codec. The route validates on the audio/* prefix and forwards it as-is.
      const contentType = fullType.split(";")[0] || "audio/webm";
      void sendAudio(blob, contentType);
    };

    voiceSecondsRef.current = 0;
    setVoiceSeconds(0);
    voiceTimerRef.current = window.setInterval(() => {
      voiceSecondsRef.current += 1;
      setVoiceSeconds(voiceSecondsRef.current);
      if (voiceSecondsRef.current >= VOICE_MAX_RECORDING_SECONDS) {
        stopRecording();
      }
    }, 1000);

    recorder.start();
    startVoiceLevelMeter(stream);
    setVoiceState("recording");
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (!recorder || recorder.state === "inactive") {
      clearVoiceTimer();
      return;
    }
    recorder.stop(); // → onstop builds the blob and calls sendAudio
  }

  /** Mirrors send()'s session-replacement seam, but posts the recorded audio to
   *  the /voice route instead of typed text. That route transcribes via Deepgram
   *  and returns the SAME { session } shape, so the state update is identical.
   *  The typed-text send() is deliberately left untouched. */
  async function sendAudio(blob: Blob, contentType: string) {
    if (!isOpen) return;
    setError(null);
    setVoiceState("sending");
    setLoading(true);
    try {
      const res = await fetch(`/api/interview/${token}/voice`, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: blob,
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
      setVoiceState("idle");
    } catch (err) {
      // Audio turn failed — surface the message and drop back to idle so the
      // participant can retry by mic or just type their answer instead.
      setError(err instanceof Error ? err.message : t("error.generic"));
      setVoiceState("idle");
    } finally {
      setLoading(false);
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
      // Don't fire a typed turn while a voice turn is recording/sending — that
      // would race a second advanceInterview on the same session. Mirrors the
      // send button's guard (inert when voiceEnabled is off → voiceState stays
      // "init"). The textarea stays editable; only the submit waits.
      if (voiceState === "recording" || voiceState === "sending") return;
      void send();
    }
  }

  // Chat column — today's single-column content (heading → chat area → error →
  // sticky input / completed). A Fragment renders NO DOM node, so the
  // no-stimulus branch below (`<main>{chatColumn}</main>`) is byte-identical to
  // the previous markup; with a stimulus it becomes the split-view's right col.
  const chatColumn = (
    <>
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
          {voiceEnabled && (
            <VoiceControls
              state={voiceState}
              level={voiceLevel}
              seconds={voiceSeconds}
              disabled={loading || visualConsentPending}
              onStart={() => void startRecording()}
              onStop={stopRecording}
            />
          )}
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
              disabled={
                loading ||
                visualConsentPending ||
                voiceState === "recording" ||
                voiceState === "sending" ||
                !input.trim()
              }
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
    </>
  );

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

      {stimulus ? (
        // Split-View — Asset + Chat. Mobil: Asset oben (sticky, full-width,
        // höhenbegrenzt), Chat darunter. Desktop (lg+): Asset linke Spalte
        // (sticky top), Chat rechts. `lg:items-start` lässt das Asset oben
        // andocken; die Chat-Spalte zieht sich per `lg:self-stretch` auf volle
        // Höhe, damit ihr sticky-bottom-Input weiterhin am Viewport-Rand klebt.
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-6 lg:flex-row lg:items-start">
          <aside className="sticky top-0 z-20 self-stretch border-b border-[#E8E4F2] bg-white py-3 lg:top-6 lg:z-0 lg:w-2/5 lg:max-w-sm lg:shrink-0 lg:self-auto lg:border-b-0 lg:py-0">
            <StimulusPanel url={stimulus.url} kind={stimulus.kind} />
          </aside>
          <div className="flex w-full flex-1 flex-col lg:max-w-2xl lg:self-stretch">
            {chatColumn}
          </div>
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-6">
          {chatColumn}
        </main>
      )}
    </div>
  );
}

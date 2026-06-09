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
  /** TTS Stage 1: when true, every new agent turn (incl. the opening question)
   *  is spoken via POST /api/interview/[token]/speak and played through a
   *  DEDICATED HTMLAudioElement — fully decoupled from the level-meter
   *  AudioContext. Browser autoplay rules mean the first play needs a user
   *  gesture: the mic-start path primes playback, and a visible "enable sound"
   *  toggle is the always-available fallback (incl. pure text mode). Defaults
   *  false → byte-identical silent chat (no audio, no /speak calls). */
  ttsEnabled?: boolean;
}

/** Default Findr accent — fallback when no org accent color is set. */
const DEFAULT_ACCENT = "#4A51A8";
/** Only ever apply a caller-supplied accent if it's a strict #RRGGBB hex. */
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const FONT = "var(--font-inter), Inter, system-ui, -apple-system, sans-serif";

// A 44-byte silent WAV, used ONLY to "unlock" the TTS <audio> element from
// inside the mic-start user gesture. Playing a real (if silent, ~0-length) clip
// during a gesture marks the element as user-activated, so later programmatic
// playback of the agent's answer is permitted — especially on iOS. It's
// genuinely silent, so priming it is inaudible.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

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

/** Latest agent turn with non-empty text in `list`, or -1. Single source for
 *  both the autoplay seam and the per-bubble "can this turn still reach the
 *  /speak route" check — the route only ever speaks the conversation's latest
 *  turn, so older uncached turns can be replayed from cache but never re-synth'd. */
function latestAgentIndex(list: InterviewTurn[]): number {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const turn = list[i];
    if (turn?.role === "agent" && turn.text.trim() !== "") return i;
  }
  return -1;
}

function PlayGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

/** Per-bubble read-aloud control. Only mounted on agent bubbles when ttsEnabled
 *  (so non-TTS interviews render byte-identical bubbles). One element switches
 *  play → generating-spinner → pause; an older turn the route can no longer
 *  reach (not cached AND not the latest turn) renders as a disabled control. */
interface BubbleTts {
  state: "idle" | "loading" | "playing";
  available: boolean;
  onToggle: () => void;
  labelPlay: string;
  labelPause: string;
  labelLoading: string;
  labelUnavailable: string;
}

function BubbleTtsControl({
  state,
  available,
  onToggle,
  labelPlay,
  labelPause,
  labelLoading,
  labelUnavailable,
}: BubbleTts) {
  const label =
    state === "loading"
      ? labelLoading
      : state === "playing"
        ? labelPause
        : available
          ? labelPlay
          : labelUnavailable;
  return (
    <div className="mt-1.5 flex">
      <button
        type="button"
        onClick={onToggle}
        disabled={!available && state === "idle"}
        aria-label={label}
        title={label}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#6B6680] outline-none transition-colors hover:bg-white/70 hover:text-[#0E0A1F] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]/40 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#6B6680]"
      >
        {state === "loading" ? (
          <Spinner />
        ) : state === "playing" ? (
          <PauseGlyph />
        ) : (
          <PlayGlyph />
        )}
      </button>
    </div>
  );
}

function Bubble({
  role,
  text,
  tts,
}: {
  role: InterviewTurn["role"];
  text: string;
  tts?: BubbleTts;
}) {
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
        {tts && <BubbleTtsControl {...tts} />}
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

/** Speaker glyph for the TTS sound toggle. `muted` swaps the sound waves for an
 *  ✕ so the control reads at a glance whether read-aloud is on. */
function SpeakerIcon({ muted, size = 15 }: { muted: boolean; size?: number }) {
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
      <path d="M11 5 6 9H2v6h4l5 4z" />
      {muted ? (
        <>
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </>
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
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
  ttsEnabled = false,
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
  // Streaming turn (Perf-Etappe B1): the agent's partial message while SSE
  // deltas arrive, rendered as its own bubble. Kept OUT of `messages` on
  // purpose — every consumer of the finished transcript (TTS autoplay,
  // visual-capture submit, ttsLatestAgentIndex) keys off `messages`, which
  // only updates when the authoritative `final` event lands. So nothing can
  // act on a half-generated turn.
  const [streamText, setStreamText] = useState<string | null>(null);
  // B2: the opening turn is requested at most once per mount (the server
  // side is idempotent on top — a second request is a no-op final).
  const openingRequestedRef = useRef(false);
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
  // Set synchronously the moment a mic-start gesture begins (before the
  // getUserMedia await), cleared when that turn ends. Lets TTS bail even during
  // the permission window — closes the "enable sound → mic" barge-in race so the
  // mic never captures the AI's own voice.
  const recordingArmedRef = useRef(false);
  // Latest-value ref for the Space-bar toggle. The window listener binds once
  // per open voice session; this ref keeps it pointed at the current state +
  // handlers without rebinding on every mic-level tick. Returns whether it acted
  // so the listener only swallows Space (preventDefault) when it actually toggled.
  const voiceToggleRef = useRef<() => boolean>(() => false);

  // TTS read-aloud (additive; all inert unless ttsEnabled). The <audio> element
  // and bookkeeping live in refs so they survive re-renders; only the two
  // display flags are React state. ttsBlocked seeds true when there's an agent
  // turn to speak — a cold load has no user gesture yet, so the participant
  // sees the "enable sound" toggle from the first paint (SSR-stable: derived
  // only from props, no window access → no hydration mismatch).
  const [ttsMuted, setTtsMuted] = useState(false);
  const [ttsBlocked, setTtsBlocked] = useState(
    () =>
      ttsEnabled &&
      initialConversation.some(
        (m) => m.role === "agent" && m.text.trim() !== "",
      ),
  );
  // Which agent-turn index is currently audible / being synthesized — drive the
  // per-bubble play/pause icon + spinner. Display-only state (null = none).
  const [ttsPlayingIndex, setTtsPlayingIndex] = useState<number | null>(null);
  const [ttsLoadingIndex, setTtsLoadingIndex] = useState<number | null>(null);
  // Render-safe mirror of the cache's KEYS, so a bubble's "available" flag is
  // derived during render WITHOUT reading a ref (refs aren't render-safe). The
  // URLs themselves live in ttsCacheRef for the async playback path.
  const [ttsCachedKeys, setTtsCachedKeys] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  // Per-message MP3 cache: agent-turn index → object URL. The /speak route only
  // ever speaks the conversation's LATEST turn, so each turn is synthesized at
  // most ONCE (while it is the latest) and every later replay — including of
  // older turns — is served from here, never the route. The conversation is
  // append-only (the server returns the growing transcript), so an agent turn's
  // array index is stable and a sound cache key.
  const ttsCacheRef = useRef<Map<number, string>>(new Map());
  // Indices with a /speak fetch in flight, so a second trigger for the SAME turn
  // (autoplay racing a manual tap, or a double-click) never fires a duplicate
  // synth — keeps the "generated exactly once" guarantee.
  const ttsFetchingRef = useRef<Set<number>>(new Set());
  // Synchronous mirror of ttsMuted so the async playback path reads a fresh value
  // (state updates are async). The toggle handlers set it eagerly.
  const ttsMutedRef = useRef(false);
  // Whether playback has been unlocked by a user gesture. Once true, new agent
  // turns auto-play; until then the effect skips the (costly) synth and shows
  // the manual toggle instead of firing a /speak call the browser would block.
  const ttsUnlockedRef = useRef(false);
  // Highest agent-turn index already auto-handled, so a re-render never
  // re-autoplays the same turn (manual replay is separate, via the bubble).
  const ttsSpokenIndexRef = useRef(-1);
  // Monotonic token: each play attempt claims the next value and bails after its
  // await if a newer attempt (or a stop) has superseded it — so two interleaved
  // playbacks can't double-play, and a stop cancels an in-flight one.
  const ttsPlayGenRef = useRef(0);
  // Always-fresh mirror of `messages` for the async synth path. The /speak route
  // always speaks the server's CURRENT latest agent turn (it echoes no turn id),
  // so before caching a fetched clip we must confirm — against up-to-date state,
  // NOT the stale closure captured when the fetch started — that the turn hasn't
  // been superseded; otherwise a synth that resolves after the conversation
  // advanced would be cached under the wrong bubble.
  const messagesRef = useRef(messages);

  const isOpen = status === "open";
  const visualConsentPending =
    isOpen &&
    visualCaptureEnabled &&
    (visualCaptureState === "prompt" || visualCaptureState === "starting");
  // Computed once per render: the only turn whose audio the /speak route can
  // still synthesize. A per-bubble control is offered when its turn is cached
  // OR is this latest turn; older uncached turns render the disabled state.
  const ttsLatestAgentIndex = ttsEnabled ? latestAgentIndex(messages) : -1;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, streamText]);

  // B2: a session created without its opening (empty conversation) fetches it
  // as the FIRST streamed turn — the page painted instantly, the greeting
  // streams in. Mount-only by design: re-runs are pointless (the ref latches)
  // and the server treats duplicates as no-ops anyway.
  useEffect(() => {
    if (!isOpen) return;
    if (initialConversation.some((m) => m.role === "agent")) return;
    if (openingRequestedRef.current) return;
    openingRequestedRef.current = true;
    void requestOpening();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only opening fetch
  }, []);

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

  // Keep the synchronous muted mirror in step with the state.
  useEffect(() => {
    ttsMutedRef.current = ttsMuted;
  }, [ttsMuted]);

  // Keep the messages mirror fresh for the async synth path (see messagesRef).
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // TTS: speak each new agent turn. Watching `messages` is the ONE seam that
  // covers all three entry points — the opening question lands in the initial
  // state (R6), and both send() and sendAudio() replace `messages` with the
  // server's conversation. We mark the turn handled BEFORE playing so a
  // re-render can't re-speak it. Until a user gesture has unlocked playback we
  // skip the costly synth and just surface the "enable sound" toggle (a cold
  // load would have its autoplay blocked anyway). Fully inert unless ttsEnabled.
  useEffect(() => {
    if (!ttsEnabled) return;
    const latest = latestAgentIndex(messages);
    if (latest === -1 || latest === ttsSpokenIndexRef.current) return;
    ttsSpokenIndexRef.current = latest;
    if (ttsMuted) return;
    if (!ttsUnlockedRef.current) {
      setTtsBlocked(true);
      return;
    }
    void playTtsForIndex(latest);
  }, [messages, ttsEnabled, ttsMuted]);

  // Release the audio element + EVERY cached blob URL on unmount (not just the
  // current one) — the whole per-message cache is freed so nothing leaks and no
  // clip keeps playing after the participant navigates away. The cache Map is
  // captured here (its identity is stable for the component's life) so the
  // cleanup frees exactly the object we accumulated, not a moving ref target.
  useEffect(() => {
    const cache = ttsCacheRef.current;
    return () => {
      const audio = ttsAudioRef.current;
      if (audio) {
        try {
          audio.pause();
        } catch {
          // ignore
        }
        audio.onended = null;
      }
      for (const url of cache.values()) {
        URL.revokeObjectURL(url);
      }
      cache.clear();
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
    recordingArmedRef.current = false;
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

  // ── TTS read-aloud ────────────────────────────────────────────────────────
  // A dedicated HTMLAudioElement, created lazily on the client. It is fully
  // separate from the level-meter's AudioContext (audioContextRef), so
  // stopVoiceLevelMeter() closing that context never touches TTS playback, and
  // TTS playback never feeds the mic analyser — Voice STT, VI and TTS coexist.
  function ensureTtsAudio(): HTMLAudioElement {
    let audio = ttsAudioRef.current;
    if (!audio) {
      audio = new Audio();
      audio.preload = "auto";
      ttsAudioRef.current = audio;
    }
    return audio;
  }

  /** Pauses the audio element and clears the "playing" badge — WITHOUT touching
   *  the cache (URLs are kept for replay) or the gen token. Internal helper used
   *  at the top of a fresh playback to silence whatever was playing. */
  function haltTtsAudio() {
    const audio = ttsAudioRef.current;
    if (audio) {
      try {
        audio.pause();
      } catch {
        // ignore
      }
    }
    setTtsPlayingIndex(null);
  }

  /** Stops playback AND invalidates any in-flight play/fetch by bumping the gen
   *  token (a synth that resolves later still caches its result, but won't start
   *  playing). Cached URLs are deliberately kept — freed only on unmount — so a
   *  stopped turn can still be replayed from cache. Safe to call repeatedly. */
  function stopTtsPlayback() {
    ttsPlayGenRef.current += 1;
    haltTtsAudio();
  }

  /** Best-effort autoplay unlock, called SYNCHRONOUSLY inside the mic-start user
   *  gesture (before any await). Playing a silent clip within the gesture marks
   *  the element user-activated so the agent's next answer can play without a
   *  tap. Harmless on failure — the visible toggle is the fallback. */
  function unlockTtsPlayback() {
    if (!ttsEnabled || ttsUnlockedRef.current) return;
    const audio = ensureTtsAudio();
    try {
      audio.onended = null;
      audio.src = SILENT_WAV;
      const played = audio.play();
      if (played && typeof played.then === "function") {
        played
          .then(() => {
            ttsUnlockedRef.current = true;
          })
          .catch(() => {
            // Gesture too short / blocked — manual toggle still works.
          });
      } else {
        ttsUnlockedRef.current = true;
      }
    } catch {
      // ignore — unlock is best-effort
    }
  }

  /** Binds a cached / just-synth'd object URL to the audio element and plays it,
   *  tracking the playing index. `gen` is the caller's claim token: every state
   *  write re-checks it so a superseded attempt goes silent. A blocked play()
   *  (no user gesture yet) flips ttsBlocked so the manual toggle appears. */
  async function playTtsUrl(url: string, index: number, gen: number) {
    const audio = ensureTtsAudio();
    audio.src = url;
    audio.onended = () => {
      if (gen === ttsPlayGenRef.current) {
        setTtsPlayingIndex((cur) => (cur === index ? null : cur));
      }
    };
    try {
      await audio.play();
      if (gen !== ttsPlayGenRef.current) return;
      ttsUnlockedRef.current = true;
      setTtsBlocked(false);
      setTtsPlayingIndex(index);
    } catch {
      // Autoplay blocked (no gesture yet) — surface the manual enable toggle.
      if (gen === ttsPlayGenRef.current) setTtsBlocked(true);
    }
  }

  /** Plays a single agent turn — autoplay of the newest, or a manual replay of
   *  any bubble. Replay is CACHE-FIRST: an already-synth'd turn never hits the
   *  route again. A cache MISS may only fetch when this turn is still the latest
   *  (the /speak route can't reach older turns); the blob is cached exactly once
   *  and then played unless a newer turn / mute / mic gesture superseded it.
   *  Muted or unreachable → no-op. Best-effort: fetch errors stay silent so the
   *  interview continues text-only. Never talks over a live recording (R5). */
  async function playTtsForIndex(index: number) {
    if (!ttsEnabled || ttsMutedRef.current) return;
    const turn = messages[index];
    if (!turn || turn.role !== "agent" || turn.text.trim() === "") return;

    // Cache hit → replay locally, never the route. Claim the slot + silence the
    // previous clip first.
    const cached = ttsCacheRef.current.get(index);
    if (cached) {
      const gen = ++ttsPlayGenRef.current;
      haltTtsAudio();
      await playTtsUrl(cached, index, gen);
      return;
    }

    // Cache miss. The route only ever speaks the conversation's latest turn, so
    // an older uncached turn is unreachable — its bubble is disabled and we never
    // call the route for it.
    if (index !== latestAgentIndex(messages)) return;
    // Dedup: a synth for this turn is already in flight (autoplay racing a tap) →
    // let it finish; it will play. Keeps the "generated exactly once" guarantee.
    if (ttsFetchingRef.current.has(index)) return;

    const gen = ++ttsPlayGenRef.current;
    haltTtsAudio();
    ttsFetchingRef.current.add(index);
    setTtsLoadingIndex(index);
    let blob: Blob | null = null;
    try {
      const res = await fetch(`/api/interview/${token}/speak`, {
        method: "POST",
      });
      if (res.ok) blob = await res.blob();
    } catch {
      // network hiccup — TTS is non-critical; fall through to clear + bail
    } finally {
      ttsFetchingRef.current.delete(index);
    }
    setTtsLoadingIndex((cur) => (cur === index ? null : cur));
    if (!blob || blob.size === 0) return;
    // STALE-INDEX GUARD: the /speak route always synthesizes the server's CURRENT
    // latest agent turn and echoes no turn id, so this clip is provably `index`'s
    // audio ONLY if `index` is STILL the latest agent turn now. The conversation
    // is append-only, so "still latest" ⟺ no newer turn was appended while the
    // synth was in flight ⟺ the server read `index` as latest. If it advanced
    // mid-fetch, the clip may belong to the newer turn — DISCARD it rather than
    // cache the wrong audio under this bubble (the newer turn's own autoplay
    // fetches + caches its clip correctly). messagesRef is fresh; the closure's
    // `messages` is stale across the await.
    if (index !== latestAgentIndex(messagesRef.current)) return;
    // Cache exactly once (we held the only in-flight fetch for this index), even
    // if we no longer play it — so the spend isn't wasted and replay stays local.
    const url = URL.createObjectURL(blob);
    ttsCacheRef.current.set(index, url);
    setTtsCachedKeys((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    // Re-check after the await: superseded by a newer turn, muted, or a mic-start
    // gesture is in progress (incl. its getUserMedia window, before the recorder
    // exists) → keep it cached but don't talk over the mic.
    if (gen !== ttsPlayGenRef.current || ttsMutedRef.current) return;
    if (
      recordingArmedRef.current ||
      mediaRecorderRef.current?.state === "recording"
    ) {
      return;
    }
    await playTtsUrl(url, index, gen);
  }

  /** Global "enable sound" toggle: unmute, unlock playback inside this gesture
   *  (a SYNCHRONOUS silent play blesses the element for user activation — needed
   *  on iOS / in pure text mode where no mic gesture ever unlocked it), and play
   *  the current question. Sets the muted mirror eagerly so the in-flight fetch
   *  isn't skipped by a stale ref. */
  function enableTtsSound() {
    setTtsMuted(false);
    ttsMutedRef.current = false;
    setTtsBlocked(false);
    unlockTtsPlayback();
    const latest = latestAgentIndex(messages);
    if (latest !== -1) void playTtsForIndex(latest);
  }

  /** Global "mute" toggle: mute + stop the current clip (cache kept for replay). */
  function muteTtsSound() {
    setTtsMuted(true);
    ttsMutedRef.current = true;
    stopTtsPlayback();
  }

  /** Per-bubble play/pause. Tapping the active turn (playing OR generating) stops
   *  it; tapping any other reachable turn plays it (from cache, or — if it's the
   *  latest — synth'd once). A manual tap is intent to hear, so it unlocks the
   *  element in-gesture and lifts a global mute. */
  function toggleBubbleTts(index: number) {
    unlockTtsPlayback();
    if (ttsPlayingIndex === index || ttsLoadingIndex === index) {
      stopTtsPlayback();
      setTtsLoadingIndex((cur) => (cur === index ? null : cur));
      return;
    }
    if (ttsMutedRef.current) {
      setTtsMuted(false);
      ttsMutedRef.current = false;
    }
    setTtsBlocked(false);
    void playTtsForIndex(index);
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
    // R5 (race): arm synchronously, before the getUserMedia await, so an in-flight
    // /speak that resolves DURING the permission window bails instead of speaking
    // into the about-to-open mic. Cleared on every exit path below.
    recordingArmedRef.current = true;
    setError(null);
    // R2: prime TTS autoplay inside this user gesture (synchronous, before the
    // getUserMedia await consumes the activation) so the agent's next answer can
    // speak without a tap. R5: silence any TTS that's currently playing so the
    // mic doesn't capture the AI's own voice (manual barge-in). Both no-op when
    // ttsEnabled is false.
    unlockTtsPlayback();
    stopTtsPlayback();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Permission denied or no microphone — fall back to typing.
      recordingArmedRef.current = false;
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
      recordingArmedRef.current = false;
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
      recordingArmedRef.current = false;
      clearVoiceTimer();
      return;
    }
    recorder.stop(); // → onstop builds the blob and calls sendAudio (clears armed)
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

  /** Adopt the server's authoritative session view — the ONE place the
   *  transcript/status update after a turn (stream final, resync, opening). */
  function applySession(session: SessionView) {
    if (session.status === "completed") {
      void submitVisualCapture();
    }
    setMessages(session.conversation);
    setStatus(session.status);
  }

  /** POST to the SSE turn route; feeds deltas into streamText and returns the
   *  authoritative final session. Throws on transport failure, a missing
   *  final event, or a server-sent `error` event — callers resync. */
  async function streamTurn(payload: { message?: string }): Promise<SessionView> {
    const res = await fetch(`/api/interview/${token}/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !res.body || !contentType.includes("text/event-stream")) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? t("error.requestFailed"));
    }

    let finalSession: SessionView | null = null;
    let streamError: string | null = null;

    const handleEvent = (rawEvent: string) => {
      let event = "message";
      const dataLines: string[] = [];
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
      if (dataLines.length === 0) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(dataLines.join("\n"));
      } catch {
        return;
      }
      if (event === "delta") {
        const text = (parsed as { text?: unknown }).text;
        if (typeof text === "string" && text) {
          setStreamText((prev) => (prev ?? "") + text);
        }
      } else if (event === "final") {
        finalSession = (parsed as { session?: SessionView }).session ?? null;
      } else if (event === "error") {
        streamError = (parsed as { error?: string }).error ?? t("error.generic");
      }
    };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        handleEvent(buffer.slice(0, sep));
        buffer = buffer.slice(sep + 2);
      }
    }
    if (buffer.trim()) handleEvent(buffer);

    if (streamError) throw new Error(streamError);
    if (!finalSession) throw new Error(t("error.requestFailed"));
    return finalSession;
  }

  /** One GET against the session — used to converge after a broken stream
   *  (the turn may or may not have persisted server-side). */
  async function resyncSession(): Promise<SessionView | null> {
    try {
      const res = await fetch(`/api/interview/${token}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { session?: SessionView };
      return data.session ?? null;
    } catch {
      return null;
    }
  }

  /** B2: fetch the opening turn as the first streamed turn. */
  async function requestOpening() {
    setError(null);
    setLoading(true);
    try {
      const session = await streamTurn({});
      applySession(session);
    } catch {
      // The opening may still have persisted server-side (the route finishes
      // the turn even when the stream dies) — one resync converges.
      const synced = await resyncSession();
      if (synced && synced.conversation.some((m) => m.role === "agent")) {
        applySession(synced);
      } else {
        setError(t("error.generic"));
        // Allow another attempt if the participant triggers a re-render path
        // (e.g. reload); within this mount the latch stays closed on purpose.
      }
    } finally {
      setStreamText(null);
      setLoading(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || !isOpen || visualConsentPending) return;
    // B2: nothing to answer until the opening turn exists.
    if (!messages.some((m) => m.role === "agent")) return;

    // Captured BEFORE the optimistic append: a server-advanced conversation
    // must have grown by at least customer+agent relative to this.
    const expectedMinLength = messages.length + 2;

    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "customer", text }]);
    setLoading(true);

    try {
      const session = await streamTurn({ message: text });
      applySession(session);
    } catch (err) {
      // The stream can die before OR after the server ran the turn. NEVER
      // blind-retry (a second advanceInterview would duplicate the turn) —
      // resync instead and only roll back when the message verifiably never
      // landed.
      const synced = await resyncSession();
      const landed =
        synced !== null &&
        synced.conversation.length >= expectedMinLength &&
        synced.conversation
          .slice(-2)
          .some((m) => m.role === "customer" && m.text === text);
      if (landed && synced) {
        applySession(synced);
      } else {
        // Roll back the optimistic message and let the buyer resend.
        setMessages((prev) =>
          prev.filter(
            (m, i) =>
              !(i === prev.length - 1 && m.role === "customer" && m.text === text),
          ),
        );
        setInput(text);
        setError(err instanceof Error ? err.message : t("error.generic"));
      }
    } finally {
      setStreamText(null);
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
          <Bubble
            key={i}
            role={m.role}
            text={m.text}
            tts={
              ttsEnabled && m.role === "agent" && m.text.trim() !== ""
                ? {
                    state:
                      ttsLoadingIndex === i
                        ? "loading"
                        : ttsPlayingIndex === i
                          ? "playing"
                          : "idle",
                    available:
                      ttsCachedKeys.has(i) || i === ttsLatestAgentIndex,
                    onToggle: () => toggleBubbleTts(i),
                    labelPlay: t("tts.play"),
                    labelPause: t("tts.pause"),
                    labelLoading: t("tts.loading"),
                    labelUnavailable: t("tts.unavailable"),
                  }
                : undefined
            }
          />
        ))}
        {streamText !== null && streamText !== "" && (
          // B1: the agent's in-flight message, growing as deltas arrive. No
          // tts control — that appears when the turn finalizes into
          // `messages` (and the TTS autoplay effect fires exactly then).
          <Bubble role="agent" text={streamText} />
        )}
        {loading && !streamText && <TypingBubble />}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-[#FFD7D0] bg-[#FFF3F1] px-4 py-2 text-[13px] text-[#C9442F]">
          {error}
        </div>
      )}

      {isOpen ? (
        <div className="sticky bottom-0 mt-6 bg-white pb-6 pt-2">
          {ttsEnabled && (
            // Read-aloud sound toggle + autoplay safety net (R2/R7/R12). Shows
            // "enable sound" while muted OR while autoplay is blocked (no
            // gesture yet / iOS) — one tap unmutes, unlocks and plays the
            // current question; otherwise it's a mute control. Works in pure
            // text mode too, where there is no mic gesture to rely on.
            <div className="mb-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={
                  ttsMuted || ttsBlocked ? enableTtsSound : muteTtsSound
                }
                aria-pressed={!ttsMuted && !ttsBlocked}
                className="inline-flex h-[36px] shrink-0 items-center gap-2 rounded-full border border-[#E8E4F2] bg-[#FAFAFE] px-3.5 text-[12px] font-medium text-[#0E0A1F] transition-colors hover:bg-[#F4F1FD]"
              >
                <SpeakerIcon muted={ttsMuted || ttsBlocked} />
                {ttsMuted || ttsBlocked ? t("tts.enable") : t("tts.mute")}
              </button>
              <span className="text-[11px] leading-snug text-[#8A85A0]">
                {ttsMuted
                  ? t("tts.mutedHint")
                  : ttsBlocked
                    ? t("tts.blockedHint")
                    : t("tts.onHint")}
              </span>
            </div>
          )}
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

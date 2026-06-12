"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { WithdrawDataLink } from "./WithdrawDataLink";
import type { Room } from "livekit-client";
import type { InterviewTurn } from "@/lib/voice-agent/interviewer";

/**
 * Voice Phase 2 (E1) — the participant-facing LiveKit voice interview.
 *
 * Rendered by the interview page INSTEAD of InterviewChat when the plan has
 * voice_enabled (O1: LiveKit fully replaces the push-to-talk provisional; the
 * text fallback is the same page with ?mode=text → InterviewChat with
 * voiceEnabled=false). Non-voice studies never load this component — and
 * `livekit-client` itself is imported lazily inside the start gesture, so even
 * the voice page's initial paint ships zero LiveKit bytes.
 *
 * Contract (Phase 1 backend, unchanged here):
 *   - POST /api/voice/token { token: <URL session token> }
 *     → { serverUrl, roomName, token }. The Python agent joins via dispatch,
 *     loads context, persists transcript turns and calls complete — this
 *     component only connects, moves audio in/out and renders live state.
 *   - Live captions arrive on the `lk.transcription` text stream
 *     (TranscriptSynchronizer → RoomIO). E3: they are no longer rendered as a
 *     running ticker — the live view centers a state-driven orb instead. The
 *     stream is still consumed and kept in state: the collapsed "last
 *     question" fallback (accessibility: didn't catch it acoustically) shows
 *     the newest agent segment, with the server-rendered history as fallback.
 *     Deliberately NO polling endpoint (O2).
 *   - The orb state comes from the standard `lk.agent.state` participant
 *     attribute (initializing/listening/thinking/speaking) published by the
 *     livekit-agents session; if the attribute never arrives we degrade to
 *     the ActiveSpeakersChanged boolean (speaking/listening only).
 *
 * Completion: the agent finishes → room empties / disconnects → we re-render
 * the server component (router.refresh, bounded attempts) until the session
 * status prop flips to non-open, then show the completed screen (incl. the
 * panel provider redirect). Still open after the attempts → honest
 * "connection lost" error with retry.
 */

type Status = "open" | "completed" | "abandoned";

interface VoiceInterviewViewProps {
  token: string;
  initialConversation: InterviewTurn[];
  initialStatus: Status;
  /** Research plan title — used as the h1 (voice is research-only). */
  headingOverride?: string | null;
  /** White-label chrome — same semantics as InterviewChat's brandless mode. */
  brandName?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  /** Panel provider complete-return URL — redirect on the completed screen. */
  panelCompleteRedirect?: string | null;
  /** Stimulus split-view. E4: voice renders image, link AND video (the text
   *  chat still coerces "video" to null — untouched). The panel starts hidden
   *  behind a placeholder and is revealed by the agent's
   *  {"type":"stimulus","action":"show"} DataPacket (play/pause steer the
   *  video), with a timed fallback if the agent never sends one. */
  stimulusUrl?: string | null;
  stimulusType?: string | null;
}

type Phase = "intro" | "connecting" | "live" | "ended" | "done" | "error";

type ErrorKind =
  | "micDenied"
  | "micUnavailable"
  | "rejected"
  | "unavailable"
  | "agent"
  | "lost";

interface LiveSegment {
  key: string;
  role: InterviewTurn["role"];
  text: string;
  final: boolean;
}

/** `lk.agent.state` values published by the livekit-agents AgentSession. */
type AgentState = "initializing" | "listening" | "thinking" | "speaking";

function parseAgentState(value: string | undefined): AgentState | null {
  return value === "initializing" ||
    value === "listening" ||
    value === "thinking" ||
    value === "speaking"
    ? value
    : null;
}

const DEFAULT_ACCENT = "#4A51A8";
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const FONT = "var(--font-inter), Inter, system-ui, -apple-system, sans-serif";

/** How long we wait for the agent to join the room before failing honestly —
 *  the agent currently runs locally (hosting is Phase 3), so "not reachable"
 *  is a real, expected state that must never look like an endless spinner. */
const AGENT_JOIN_TIMEOUT_MS = 20_000;

/** Status re-checks after the room ended (router.refresh → status prop). */
const ENDED_CHECK_ATTEMPTS = 4;
const ENDED_CHECK_INTERVAL_MS = 1_500;

/** E4: if the agent never sends the {"type":"stimulus","action":"show"}
 *  DataPacket (it could forget the tool call), reveal the panel anyway this
 *  long after the room connection was established. */
const STIMULUS_REVEAL_FALLBACK_MS = 90_000;

/** Collapse whitespace + case for the opening-echo comparison. */
function normalizeForEcho(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Ring spinner — mirrors InterviewChat's Spinner (motion-safe gated). */
function RingSpinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin ${className}`}
      aria-hidden="true"
    />
  );
}

function MicGlyph({ size = 16, muted = false }: { size?: number; muted?: boolean }) {
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
      {muted && <line x1="4" y1="4" x2="20" y2="20" />}
    </svg>
  );
}

/** Reveal transition for the stimulus panel (E4) — opacity/transform only,
 *  frozen entirely under prefers-reduced-motion (the placeholder→panel swap
 *  then happens instantly, which is the reduced-motion-correct behavior). */
const STIMULUS_CSS = `
@keyframes voice-stimulus-reveal {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
.voice-stimulus-reveal {
  animation: voice-stimulus-reveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  .voice-stimulus-reveal { animation: none; }
}
`;

/** Local copy of the chat's stimulus panel (it is module-private there and
 *  InterviewChat stays untouched by design). Same i18n keys, same markup —
 *  plus a video branch the chat doesn't have (E4: the agent steers playback
 *  via play/pause DataPackets; controls stay on for the participant since
 *  un-gestured play() may be blocked by autoplay policies). */
function VoiceStimulusPanel({
  url,
  kind,
  videoRef,
}: {
  url: string;
  kind: "image" | "link" | "video";
  videoRef?: (el: HTMLVideoElement | null) => void;
}) {
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
      ) : kind === "video" ? (
        <video
          ref={videoRef}
          src={url}
          controls
          playsInline
          preload="metadata"
          aria-label={t("stimulus.videoAria")}
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
          <p className="mt-2 text-[12px] text-[#8A85A0]">{t("stimulus.newTab")}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Conversation orb — visualizes the agent state in the live phase. Pure CSS
 * keyframes on transform/opacity only (compositor-friendly, no layout work);
 * `prefers-reduced-motion` freezes everything to the static rings and the
 * text label underneath carries the state. Colors derive from the white-label
 * accent: speaking = full accent, listening = subtly lightened (`color-mix`
 * with a plain-accent fallback for browsers without it), thinking in between.
 */
const ORB_CSS = `
.voice-orb {
  position: relative;
  width: 132px;
  height: 132px;
  --orb-color: var(--brand-accent);
}
.voice-orb[data-state="listening"] {
  --orb-color: var(--brand-accent);
  --orb-color: color-mix(in oklab, var(--brand-accent) 72%, white);
}
.voice-orb[data-state="thinking"],
.voice-orb[data-state="initializing"] {
  --orb-color: var(--brand-accent);
  --orb-color: color-mix(in oklab, var(--brand-accent) 88%, white);
}
.voice-orb__halo,
.voice-orb__ring,
.voice-orb__core {
  position: absolute;
  border-radius: 9999px;
  will-change: transform, opacity;
}
.voice-orb__halo {
  inset: -24px;
  background: var(--orb-color);
  opacity: 0.12;
  filter: blur(18px);
}
.voice-orb__ring {
  inset: 0;
  border: 2px solid var(--orb-color);
  opacity: 0.35;
}
.voice-orb__core {
  inset: 20px;
  background: var(--orb-color);
}
@keyframes voice-orb-ring-speak {
  0%, 100% { transform: scale(1); opacity: 0.45; }
  50% { transform: scale(1.45); opacity: 0.12; }
}
@keyframes voice-orb-core-speak {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
@keyframes voice-orb-ring-breathe {
  0%, 100% { transform: scale(1); opacity: 0.35; }
  50% { transform: scale(1.1); opacity: 0.22; }
}
@keyframes voice-orb-core-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}
@keyframes voice-orb-ring-think {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.25); opacity: 0.18; }
}
@keyframes voice-orb-core-think {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
@keyframes voice-orb-halo-pulse {
  0%, 100% { transform: scale(1); opacity: 0.1; }
  50% { transform: scale(1.08); opacity: 0.2; }
}
.voice-orb[data-state="speaking"] .voice-orb__ring {
  animation: voice-orb-ring-speak 1.1s ease-in-out infinite;
}
.voice-orb[data-state="speaking"] .voice-orb__core {
  animation: voice-orb-core-speak 1.1s ease-in-out infinite;
}
.voice-orb[data-state="speaking"] .voice-orb__halo {
  animation: voice-orb-halo-pulse 1.1s ease-in-out infinite;
}
.voice-orb[data-state="listening"] .voice-orb__ring {
  animation: voice-orb-ring-breathe 4s ease-in-out infinite;
}
.voice-orb[data-state="listening"] .voice-orb__core {
  animation: voice-orb-core-breathe 4s ease-in-out infinite;
}
.voice-orb[data-state="thinking"] .voice-orb__ring,
.voice-orb[data-state="initializing"] .voice-orb__ring {
  animation: voice-orb-ring-think 2.2s ease-in-out infinite;
}
.voice-orb[data-state="thinking"] .voice-orb__core,
.voice-orb[data-state="initializing"] .voice-orb__core {
  animation: voice-orb-core-think 2.2s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .voice-orb__halo,
  .voice-orb__ring,
  .voice-orb__core {
    animation: none !important;
  }
}
`;

function VoiceOrb({ state }: { state: AgentState }) {
  return (
    <div className="voice-orb" data-state={state} aria-hidden="true">
      <span className="voice-orb__halo" />
      <span className="voice-orb__ring" />
      <span className="voice-orb__core" />
    </div>
  );
}

export function VoiceInterviewView({
  token,
  initialConversation,
  initialStatus,
  headingOverride = null,
  brandName = null,
  accentColor = null,
  logoUrl = null,
  panelCompleteRedirect = null,
  stimulusUrl = null,
  stimulusType = null,
}: VoiceInterviewViewProps) {
  const t = useTranslations("interview");
  const locale = useLocale();
  const router = useRouter();

  const accent =
    accentColor && HEX_COLOR.test(accentColor) ? accentColor : DEFAULT_ACCENT;
  const hasBrand = Boolean(logoUrl || brandName);

  // InterviewChat's narrowing + "video" (E4, voice-only); unknown → null.
  const stimulusKind: "image" | "link" | "video" | null =
    stimulusType === "image" || stimulusType === "link" || stimulusType === "video"
      ? stimulusType
      : null;
  const stimulus =
    stimulusUrl && stimulusKind ? { url: stimulusUrl, kind: stimulusKind } : null;

  const [phase, setPhase] = useState<Phase>(() =>
    initialStatus === "open" ? "intro" : "done",
  );
  const [errorKind, setErrorKind] = useState<ErrorKind>("unavailable");
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [liveSegments, setLiveSegments] = useState<LiveSegment[]>([]);
  const [endedTick, setEndedTick] = useState(0);
  /** `lk.agent.state` attribute value; null until the agent publishes one. */
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [showLastQuestion, setShowLastQuestion] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  /** E4: stimulus panel hidden behind the placeholder until the agent's
   *  "show" DataPacket (or the timed fallback) reveals it. Reveal is one-way
   *  for the session — repeated show events are no-ops. */
  const [stimulusRevealed, setStimulusRevealed] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const phaseRef = useRef<Phase>(phase);
  const historyRef = useRef<InterviewTurn[]>(initialConversation);
  const intentionalCloseRef = useRef(false);
  const agentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioHostRef = useRef<HTMLDivElement | null>(null);
  const stimulusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stimulusRevealedRef = useRef(false);
  const stimulusVideoRef = useRef<HTMLVideoElement | null>(null);
  /** Agent sent "play" before the (just-revealed) <video> mounted — honor it
   *  from the ref callback once the element exists. */
  const stimulusPendingPlayRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    historyRef.current = initialConversation;
  }, [initialConversation]);

  // Teardown on unmount only — flag first so the Disconnected handler stays inert.
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      if (agentTimerRef.current) clearTimeout(agentTimerRef.current);
      if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current);
      void roomRef.current?.disconnect();
    };
  }, []);

  /** E4 — idempotent: clears the fallback timer and flips the panel visible
   *  exactly once (duplicate "show" packets and a late timer are no-ops). */
  function revealStimulus() {
    if (stimulusTimerRef.current) {
      clearTimeout(stimulusTimerRef.current);
      stimulusTimerRef.current = null;
    }
    if (stimulusRevealedRef.current) return;
    stimulusRevealedRef.current = true;
    setStimulusRevealed(true);
  }

  // Ended → bounded status re-checks. router.refresh() re-renders the server
  // component; client state survives, only the props update. The status-flip
  // adjustment below resolves to "done"; running out of attempts is an honest
  // "connection lost" (agent died mid-interview without completing). All
  // setState lives in the timer callback (external-system event), never in
  // the effect body — repo lint forbids set-state-in-effect.
  useEffect(() => {
    if (phase !== "ended") return;
    const id = setTimeout(() => {
      if (endedTick >= ENDED_CHECK_ATTEMPTS) {
        setErrorKind("lost");
        setPhase("error");
      } else {
        router.refresh();
        setEndedTick(endedTick + 1);
      }
    }, ENDED_CHECK_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [phase, endedTick, router]);

  // Session status flipped server-side (agent completed → refresh delivered
  // the new prop) → completed screen. Adjust-state-in-render, NOT an effect.
  const [seenStatus, setSeenStatus] = useState(initialStatus);
  if (seenStatus !== initialStatus) {
    setSeenStatus(initialStatus);
    if (initialStatus !== "open" && (phase === "ended" || phase === "intro")) {
      setPhase("done");
    }
  }

  // Completed screen: same panel-provider redirect semantics as CompletedPanel.
  useEffect(() => {
    if (phase === "done" && panelCompleteRedirect) {
      window.location.href = panelCompleteRedirect;
    }
  }, [phase, panelCompleteRedirect]);

  function fail(kind: ErrorKind) {
    if (agentTimerRef.current) {
      clearTimeout(agentTimerRef.current);
      agentTimerRef.current = null;
    }
    if (stimulusTimerRef.current) {
      clearTimeout(stimulusTimerRef.current);
      stimulusTimerRef.current = null;
    }
    const room = roomRef.current;
    if (room) {
      intentionalCloseRef.current = true;
      roomRef.current = null;
      void room.disconnect();
    }
    setErrorKind(kind);
    setPhase("error");
  }

  /** True while an agent caption is still just (a prefix of) the last agent
   *  turn already in the server-rendered history — the agent speaks the
   *  opening question that the page already shows, so we suppress the echo. */
  function isHistoryEcho(text: string): boolean {
    const lastAgent = [...historyRef.current]
      .reverse()
      .find((turn) => turn.role === "agent");
    if (!lastAgent) return false;
    const h = normalizeForEcho(lastAgent.text);
    const s = normalizeForEcho(text);
    return s.length > 0 && (h === s || h.startsWith(s));
  }

  function upsertSegment(
    key: string,
    role: InterviewTurn["role"],
    text: string,
    final: boolean,
  ) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (role === "agent" && isHistoryEcho(trimmed)) return;
    setLiveSegments((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      if (idx === -1) return [...prev, { key, role, text: trimmed, final }];
      const next = prev.slice();
      next[idx] = { ...next[idx], text: trimmed, final: final || next[idx].final };
      return next;
    });
  }

  async function start() {
    setPhase("connecting");
    setLiveSegments([]);
    setEndedTick(0);
    setAgentSpeaking(false);
    setAgentState(null);
    setShowLastQuestion(false);
    setConfirmEnd(false);
    setMuted(false);
    setAudioBlocked(false);
    setReconnecting(false);
    intentionalCloseRef.current = false;

    // 1 — microphone permission first, as its own distinct error surface.
    // The start click is also the user gesture that unlocks audio playback.
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((track) => track.stop());
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      fail(
        name === "NotAllowedError" || name === "SecurityError"
          ? "micDenied"
          : "micUnavailable",
      );
      return;
    }

    // 2 — LiveKit entry ticket + the client library, in parallel. This is the
    // ONLY place livekit-client is loaded (zero bytes before the gesture).
    let serverUrl: string;
    let lkToken: string;
    let lk: typeof import("livekit-client");
    try {
      const [mod, res] = await Promise.all([
        import("livekit-client"),
        fetch("/api/voice/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }),
      ]);
      lk = mod;
      if (!res.ok) {
        if (res.status === 409) {
          // Session no longer open — the agent (or another tab) finished it.
          setPhase("done");
          return;
        }
        fail(res.status === 503 ? "unavailable" : "rejected");
        return;
      }
      const body = (await res.json()) as { serverUrl: string; token: string };
      serverUrl = body.serverUrl;
      lkToken = body.token;
    } catch {
      fail("unavailable");
      return;
    }

    // 3 — connect, publish the mic, wait for the agent.
    const room = new lk.Room();
    roomRef.current = room;

    const goLive = () => {
      if (agentTimerRef.current) {
        clearTimeout(agentTimerRef.current);
        agentTimerRef.current = null;
      }
      if (phaseRef.current === "connecting") setPhase("live");
    };

    room.on(lk.RoomEvent.ParticipantConnected, (participant) => {
      const state = parseAgentState(participant.attributes?.["lk.agent.state"]);
      if (state) setAgentState(state);
      goLive();
    });
    // Orb state — the agents framework publishes `lk.agent.state` on the
    // agent participant. Guard against the local participant anyway and let
    // parseAgentState drop anything unknown.
    room.on(lk.RoomEvent.ParticipantAttributesChanged, (changed, participant) => {
      if (participant === room.localParticipant) return;
      const state = parseAgentState(changed["lk.agent.state"]);
      if (state) setAgentState(state);
    });
    room.on(lk.RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === lk.Track.Kind.Audio) {
        const el = track.attach();
        audioHostRef.current?.appendChild(el);
      }
    });
    room.on(lk.RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((el) => el.remove());
    });
    room.on(lk.RoomEvent.ActiveSpeakersChanged, (speakers) => {
      setAgentSpeaking(speakers.some((p) => p !== room.localParticipant));
    });
    room.on(lk.RoomEvent.AudioPlaybackStatusChanged, () => {
      setAudioBlocked(!room.canPlaybackAudio);
    });
    room.on(lk.RoomEvent.Reconnecting, () => setReconnecting(true));
    room.on(lk.RoomEvent.Reconnected, () => setReconnecting(false));
    // E4 — stimulus control packets from the agent. Strictly defensive:
    // anything that isn't valid JSON of the expected shape is silently
    // ignored (the topic is shared, other packet types may appear later).
    if (stimulus) {
      // (DataReceived only ever delivers remote packets — no local guard.)
      room.on(lk.RoomEvent.DataReceived, (payload) => {
        let message: unknown;
        try {
          message = JSON.parse(new TextDecoder().decode(payload));
        } catch {
          return;
        }
        if (typeof message !== "object" || message === null) return;
        const { type, action } = message as { type?: unknown; action?: unknown };
        if (type !== "stimulus") return;
        if (action === "show") {
          revealStimulus();
        } else if (action === "play" || action === "pause") {
          // Playback steering implies visibility — reveal first if needed.
          revealStimulus();
          const video = stimulusVideoRef.current;
          if (action === "play") {
            if (video) {
              // Autoplay policies may still block un-gestured play() — the
              // participant keeps the native controls as fallback.
              void video.play().catch(() => {});
            } else {
              stimulusPendingPlayRef.current = true;
            }
          } else {
            stimulusPendingPlayRef.current = false;
            video?.pause();
          }
        }
      });
    }
    room.on(lk.RoomEvent.ParticipantDisconnected, () => {
      // Agent left. Normal end of the interview → verify the status flip.
      if (phaseRef.current === "live" && room.remoteParticipants.size === 0) {
        intentionalCloseRef.current = true;
        roomRef.current = null;
        void room.disconnect();
        setPhase("ended");
      }
    });
    room.on(lk.RoomEvent.Disconnected, () => {
      if (intentionalCloseRef.current) return;
      roomRef.current = null;
      if (phaseRef.current === "live") {
        setPhase("ended");
      } else if (phaseRef.current === "connecting") {
        fail("agent");
      }
    });

    // Live captions (O2) — the agent's TranscriptSynchronizer publishes both
    // sides on this topic. Pure display; persistence is the agent's job. If
    // nothing ever arrives, the ticker keeps the history + shows a hint.
    room.registerTextStreamHandler("lk.transcription", (reader, participant) => {
      const attrs = reader.info.attributes ?? {};
      const key = attrs["lk.segment_id"] ?? reader.info.id;
      const role: InterviewTurn["role"] =
        participant.identity === room.localParticipant.identity
          ? "customer"
          : "agent";
      const final = attrs["lk.transcription_final"] === "true";
      void (async () => {
        let acc = "";
        try {
          for await (const chunk of reader) {
            acc += chunk;
            upsertSegment(key, role, acc, final);
          }
          upsertSegment(key, role, acc, final);
        } catch {
          // Stream aborted mid-read — keep whatever portion we showed.
        }
      })();
    });

    try {
      await room.connect(serverUrl, lkToken);
      await room.localParticipant.setMicrophoneEnabled(true);
      // Inside the gesture chain — unlocks agent audio (iOS included). The
      // AudioPlaybackStatusChanged handler shows a manual button if it fails.
      void room.startAudio().catch(() => setAudioBlocked(!room.canPlaybackAudio));
    } catch {
      fail("unavailable");
      return;
    }

    // E4 — fallback: connection established but no "show" packet after 90 s
    // (agent forgot the tool) → reveal anyway. Cleared by revealStimulus.
    if (stimulus && !stimulusRevealedRef.current) {
      if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current);
      stimulusTimerRef.current = setTimeout(() => {
        stimulusTimerRef.current = null;
        revealStimulus();
      }, STIMULUS_REVEAL_FALLBACK_MS);
    }

    if (room.remoteParticipants.size > 0) {
      goLive();
    } else {
      agentTimerRef.current = setTimeout(() => {
        agentTimerRef.current = null;
        if (phaseRef.current === "connecting") fail("agent");
      }, AGENT_JOIN_TIMEOUT_MS);
    }
  }

  /** Participant-initiated end — the exact disconnect path the agent-left
   *  handler uses, so the ended-phase status polling (and thus the agent's
   *  complete flow) runs identically. No new backend involved. */
  function endInterview() {
    const room = roomRef.current;
    intentionalCloseRef.current = true;
    roomRef.current = null;
    if (room) void room.disconnect();
    setConfirmEnd(false);
    setPhase("ended");
  }

  async function toggleMute() {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!next);
      setMuted(next);
    } catch {
      // Mic grab failed (e.g. permission revoked mid-call) — stay as-is.
    }
  }

  const heading = headingOverride ?? t("header.titleResearch");

  // Orb state: prefer the published agent state, fall back to the
  // ActiveSpeakersChanged boolean if the attribute never arrived.
  const orbState: AgentState =
    agentState ?? (agentSpeaking ? "speaking" : "listening");

  // Accessibility fallback ("didn't catch that"): newest agent caption, or —
  // before any caption arrived — the last agent turn already in the history
  // (the opening question is suppressed as an echo, so it only lives there).
  const lastAgentText =
    [...liveSegments].reverse().find((seg) => seg.role === "agent")?.text ??
    [...initialConversation].reverse().find((turn) => turn.role === "agent")
      ?.text ??
    null;

  // ── Right-column content per phase ────────────────────────────────────────
  let content: React.ReactNode;

  if (phase === "done") {
    content = (
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
  } else if (phase === "error") {
    content = (
      <div className="mt-6 rounded-xl border border-[#FFD7D0] bg-[#FFF3F1] px-5 py-5">
        <h2 className="text-[15px] font-semibold text-[#C9442F]">
          {t(`voiceLive.errors.${errorKind}.title`)}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#9A4334]">
          {t(`voiceLive.errors.${errorKind}.body`)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {errorKind !== "rejected" && (
            <button
              type="button"
              onClick={() => void start()}
              className="h-[40px] rounded-lg bg-[var(--brand-accent)] px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            >
              {t("voiceLive.errors.retry")}
            </button>
          )}
          <a
            href="?mode=text"
            className="inline-flex h-[40px] items-center rounded-lg border border-[#D9D4E8] bg-white px-4 text-[13px] font-medium text-[#0E0A1F] transition-colors hover:bg-[#F4F1FD]"
          >
            {t("voiceLive.errors.fallbackCta")}
          </a>
        </div>
      </div>
    );
  } else if (phase === "intro") {
    content = (
      <div className="mt-2 rounded-xl border border-[#E8E4F2] bg-[#FAFAFE] px-5 py-5">
        <h2 className="text-[15px] font-semibold text-[#0E0A1F]">
          {t("voiceLive.intro.title")}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6B6680]">
          {t("voiceLive.intro.body")}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-[#8A85A0]">
          {t("voiceLive.intro.micNote")}
        </p>
        <div className="mt-5 flex flex-col items-start gap-3">
          <button
            type="button"
            onClick={() => void start()}
            className="inline-flex h-[46px] items-center gap-2 rounded-xl bg-[var(--brand-accent)] px-6 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
          >
            <MicGlyph />
            {t("voiceLive.intro.start")}
          </button>
          <a
            href="?mode=text"
            className="text-[13px] text-[#6B6680] underline underline-offset-2 transition-colors hover:text-[#0E0A1F]"
          >
            {t("voiceLive.intro.fallback")}
          </a>
        </div>
      </div>
    );
  } else if (phase === "connecting" || phase === "ended") {
    content = (
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-[#E8E4F2] bg-[#FAFAFE] px-5 py-5 text-[14px] text-[#0E0A1F]">
        <RingSpinner className="text-[var(--brand-accent)]" />
        <div>
          <p className="font-medium">
            {phase === "connecting"
              ? t("voiceLive.connecting.label")
              : t("voiceLive.ended.checking")}
          </p>
          {phase === "connecting" && (
            <p className="mt-1 text-[12px] text-[#8A85A0]">
              {t("voiceLive.connecting.agentWait")}
            </p>
          )}
        </div>
      </div>
    );
  } else {
    // ── live ── calm right column: centered orb + status label, the
    // collapsed last-question fallback underneath, mute + end at the bottom.
    const statusLabel = reconnecting
      ? t("voiceLive.live.reconnecting")
      : orbState === "speaking"
        ? t("voiceLive.live.speaking")
        : orbState === "thinking" || orbState === "initializing"
          ? t("voiceLive.live.thinking")
          : muted
            ? t("voiceLive.live.mutedStatus")
            : t("voiceLive.live.listening");
    content = (
      <>
        <style>{ORB_CSS}</style>

        {audioBlocked && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-[#E8E4F2] bg-[#FAFAFE] px-4 py-3">
            <span className="text-[12px] leading-snug text-[#6B6680]">
              {t("voiceLive.live.soundBlockedHint")}
            </span>
            <button
              type="button"
              onClick={() => void roomRef.current?.startAudio()}
              className="h-[34px] shrink-0 rounded-lg bg-[var(--brand-accent)] px-3.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
            >
              {t("voiceLive.live.soundBlocked")}
            </button>
          </div>
        )}

        <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center py-8">
          <VoiceOrb state={orbState} />
          <p
            role="status"
            className="mt-8 inline-flex items-center gap-2 text-[13px] font-medium text-[#6B6680]"
          >
            {reconnecting && <RingSpinner className="h-3 w-3 text-[#8A85A0]" />}
            {statusLabel}
          </p>

          <div className="mt-6 flex w-full max-w-md flex-col items-center">
            <button
              type="button"
              onClick={() => setShowLastQuestion((open) => !open)}
              aria-expanded={showLastQuestion}
              className="text-[12px] text-[#8A85A0] underline underline-offset-2 transition-colors hover:text-[#0E0A1F]"
            >
              {showLastQuestion
                ? t("voiceLive.lastQuestion.hide")
                : t("voiceLive.lastQuestion.show")}
            </button>
            {showLastQuestion && (
              <div className="mt-3 w-full rounded-xl border border-[#E8E4F2] bg-[#FAFAFE] px-4 py-3 text-[14px] leading-relaxed text-[#0E0A1F]">
                {lastAgentText ?? (
                  <span className="text-[#8A85A0]">
                    {t("voiceLive.lastQuestion.empty")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-col items-center gap-3 pb-2">
          {confirmEnd ? (
            <div className="w-full max-w-md rounded-xl border border-[#E8E4F2] bg-[#FAFAFE] px-4 py-4 text-center">
              <p className="text-[14px] font-semibold text-[#0E0A1F]">
                {t("voiceLive.end.confirmTitle")}
              </p>
              <p className="mt-1 text-[12px] text-[#6B6680]">
                {t("voiceLive.end.confirmBody")}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={endInterview}
                  className="h-[38px] rounded-lg bg-[var(--brand-accent)] px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                >
                  {t("voiceLive.end.confirm")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmEnd(false)}
                  className="h-[38px] rounded-lg border border-[#D9D4E8] bg-white px-4 text-[13px] font-medium text-[#0E0A1F] transition-colors hover:bg-[#F4F1FD]"
                >
                  {t("voiceLive.end.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void toggleMute()}
                aria-pressed={muted}
                className="inline-flex h-[38px] items-center gap-2 rounded-full border border-[#E8E4F2] bg-[#FAFAFE] px-4 text-[12px] font-medium text-[#0E0A1F] transition-colors hover:bg-[#F4F1FD]"
              >
                <MicGlyph size={14} muted={muted} />
                {muted ? t("voiceLive.live.unmute") : t("voiceLive.live.mute")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmEnd(true)}
                className="inline-flex h-[38px] items-center rounded-full border border-[#D9D4E8] bg-white px-4 text-[12px] font-medium text-[#6B6680] transition-colors hover:bg-[#F4F1FD] hover:text-[#0E0A1F]"
              >
                {t("voiceLive.end.button")}
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 pb-6 text-center text-[11px] text-[#9B9BA3]">
          {t("footer.brandless")}
        </p>
      </>
    );
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
            hasBrand ? "justify-between" : "justify-center"
          }`}
        >
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

      <WithdrawDataLink token={token} />

      {stimulus ? (
        // Split-view — same responsive frame as the text interview: mobile
        // stacks (asset sticky on top), desktop puts the asset in a sticky
        // left column.
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-6 lg:flex-row lg:items-start">
          <aside className="sticky top-0 z-20 self-stretch border-b border-[#E8E4F2] bg-white py-3 lg:top-6 lg:z-0 lg:w-2/5 lg:max-w-sm lg:shrink-0 lg:self-auto lg:border-b-0 lg:py-0">
            <style>{STIMULUS_CSS}</style>
            {/* "done" shows the panel directly — the conversation is over,
                there is nothing left to choreograph and the placeholder's
                "will appear during the conversation" would mislead. */}
            {stimulusRevealed || phase === "done" ? (
              <div className="voice-stimulus-reveal">
                <VoiceStimulusPanel
                  url={stimulus.url}
                  kind={stimulus.kind}
                  videoRef={(el) => {
                    stimulusVideoRef.current = el;
                    if (el && stimulusPendingPlayRef.current) {
                      stimulusPendingPlayRef.current = false;
                      void el.play().catch(() => {});
                    }
                  }}
                />
              </div>
            ) : (
              // E4 placeholder — the split-view frame is stable from first
              // paint; only the panel content swaps in on reveal.
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#8A85A0]">
                  {t("stimulus.label")}
                </p>
                <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-[#E8E4F2] bg-[#FAFAFE] px-5 py-6 lg:min-h-[200px]">
                  <p className="max-w-[28ch] text-center text-[13px] leading-relaxed text-[#8A85A0]">
                    {t("stimulus.hiddenHint")}
                  </p>
                </div>
              </div>
            )}
          </aside>
          <div className="flex w-full flex-1 flex-col lg:max-w-2xl lg:self-stretch">
            <div className="mb-6">
              <h1 className="text-[18px] font-semibold">{heading}</h1>
              <p className="mt-1 text-[14px] leading-relaxed text-[#6B6680]">
                {t("header.subtitle")}
              </p>
            </div>
            {content}
          </div>
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-6">
          <div className="mb-6">
            <h1 className="text-[18px] font-semibold">{heading}</h1>
            <p className="mt-1 text-[14px] leading-relaxed text-[#6B6680]">
              {t("header.subtitle")}
            </p>
          </div>
          {content}
        </main>
      )}

      {/* Hidden host for the agent's attached <audio> elements. */}
      <div ref={audioHostRef} className="hidden" aria-hidden="true" />
    </div>
  );
}

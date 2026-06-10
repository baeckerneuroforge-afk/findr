/**
 * Clientseitige Keyframe-Extraktion für VIDEO-Stimuli (Etappe 3) — das
 * Browser-Gegenstück zu sampleVideoFrames (vision.ts), nur ohne ffmpeg:
 * <video> + Canvas (Muster: Frame-Capture in InterviewChat). Läuft NUR im
 * Browser (document/createElement) — niemals serverseitig importieren.
 *
 * Strategie (Architektur-Freigabe Teil B):
 *  - gleichmäßiges Sampling über die Laufzeit, Frame-MITTEN statt Rändern
 *    (vermeidet Schwarzframes an Schnitt/Start/Ende),
 *  - Ziel 8–12 Frames, Hard-Cap 16,
 *  - Downscale auf ≤1280 px lange Kante (unter der High-Res-Schwelle von
 *    Opus 4.7 → ~1,2k Tokens/Frame statt bis zu ~4,8k),
 *  - JPEG ~0.7, mit Qualitäts-Fallback, falls ein Frame das per-Frame-Cap
 *    der Route (300k base64-Zeichen) reißen würde.
 *
 * Die Frames sind ein reines TRANSPORT-Artefakt: sie reisen einmal zur
 * Stimulus-Route, werden dort analysiert und nie persistiert.
 *
 * v1 bewusst nur H.264-MP4: webm/HEVC sind nicht in jedem Browser
 * dekodierbar. Jeder Dekodier-Fehler (Metadata-Timeout, error-Event, leere
 * Videodimensionen, Seek-Timeout) wirft VideoDecodeError — das Formular mappt
 * das auf eine klare "bitte als MP4 (H.264) exportieren"-Meldung.
 */

export const VIDEO_FRAME_MIN = 8;
export const VIDEO_FRAME_MAX = 16;
export const VIDEO_FRAME_LONG_EDGE = 1280;
/** Client-Spiegel der Route-Caps (stimulus/route.ts). */
export const MAX_FRAME_BASE64_CHARS = 300_000;
export const MAX_TOTAL_FRAME_BASE64_CHARS = 3_500_000;

/** Sampling-Anker: 1 Frame je ~8s ergibt das Ziel-Band (8 Frames für kurze
 *  Clips, 12 für ~90s, Cap 16 ab ~2min) — gleiche Größenordnung wie
 *  DEFAULT_SAMPLE_EVERY_SECONDS in vision.ts. */
const SAMPLE_EVERY_SECONDS = 8;
const JPEG_QUALITY_STEPS = [0.7, 0.5, 0.35] as const;
const METADATA_TIMEOUT_MS = 15_000;
const SEEK_TIMEOUT_MS = 10_000;

/** Shape == StimulusVideoFrameInput (server-only Modul → hier gespiegelt). */
export interface ExtractedVideoFrame {
  index: number;
  timestampSeconds: number;
  mediaType: "image/jpeg";
  /** Rohes base64 OHNE data-URL-Präfix (die Route validiert per Regex). */
  data: string;
}

/** Das Video ist im Browser nicht dekodierbar (Codec/Container) oder liefert
 *  keine brauchbaren Frames. Das Formular zeigt dafür eine eigene, klare
 *  Meldung (errStimulusVideoFormat) statt des generischen Upload-Fehlers. */
export class VideoDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoDecodeError";
  }
}

function once<K extends keyof HTMLVideoElementEventMap>(
  video: HTMLVideoElement,
  event: K,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
      clearTimeout(timer);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new VideoDecodeError("The browser could not decode the video."));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new VideoDecodeError(timeoutMessage));
    }, timeoutMs);
    video.addEventListener(event, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

/** Gleichmäßige Frame-Anzahl fürs Ziel-Band 8–12, Hard-Cap 16. Exported for
 *  unit tests. */
export function planFrameCount(durationSeconds: number): number {
  return Math.min(
    VIDEO_FRAME_MAX,
    Math.max(VIDEO_FRAME_MIN, Math.ceil(durationSeconds / SAMPLE_EVERY_SECONDS)),
  );
}

/**
 * Extrahiert gleichmäßig verteilte JPEG-Keyframes aus einer Videodatei.
 * Wirft VideoDecodeError bei nicht dekodierbarem Material — alle anderen
 * Fehler (z. B. ein Frame bleibt selbst bei minimaler Qualität über dem
 * Transport-Cap) werfen einen normalen Error.
 */
export async function extractVideoFrames(
  file: Blob,
): Promise<ExtractedVideoFrame[]> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    video.src = objectUrl;
    await once(
      video,
      "loadedmetadata",
      METADATA_TIMEOUT_MS,
      "Timed out while reading video metadata.",
    );

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new VideoDecodeError("The video reports no usable duration.");
    }

    const frameCount = planFrameCount(duration);
    const canvas = document.createElement("canvas");
    const frames: ExtractedVideoFrame[] = [];
    let totalChars = 0;

    for (let i = 0; i < frameCount; i++) {
      // Frame-MITTEN: (i + 0.5)/count — nie exakt 0s/Ende (Schwarzframes).
      const timestamp = ((i + 0.5) * duration) / frameCount;
      video.currentTime = timestamp;
      await once(
        video,
        "seeked",
        SEEK_TIMEOUT_MS,
        "Timed out while seeking the video.",
      );

      if (video.videoWidth <= 0 || video.videoHeight <= 0) {
        throw new VideoDecodeError("The video decoded to empty dimensions.");
      }

      const scale = Math.min(
        1,
        VIDEO_FRAME_LONG_EDGE / Math.max(video.videoWidth, video.videoHeight),
      );
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        throw new VideoDecodeError("Could not acquire a canvas context.");
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Qualitäts-Fallback pro Frame: ein sehr detailreicher Frame darf das
      // per-Frame-Cap der Route nicht reißen.
      let data: string | null = null;
      for (const quality of JPEG_QUALITY_STEPS) {
        const candidate = canvas
          .toDataURL("image/jpeg", quality)
          .replace(/^data:image\/jpeg;base64,/, "");
        if (candidate.length <= MAX_FRAME_BASE64_CHARS) {
          data = candidate;
          break;
        }
      }
      if (!data) {
        throw new Error(
          "A sampled frame exceeds the transport limit even at minimum quality.",
        );
      }

      totalChars += data.length;
      frames.push({
        index: i,
        timestampSeconds: timestamp,
        mediaType: "image/jpeg",
        data,
      });
    }

    if (totalChars > MAX_TOTAL_FRAME_BASE64_CHARS) {
      throw new Error("The sampled frames exceed the total transport limit.");
    }
    if (frames.length === 0) {
      throw new VideoDecodeError("No frames could be sampled from the video.");
    }
    return frames;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

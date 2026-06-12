import { z } from "zod";

/**
 * Geteilte Eingabe-Validierung für Stimulus-Uploads — extrahiert aus der
 * Legacy-Single-Route (api/research/plans/[id]/stimulus) und ab Multi-
 * Stimulus E2 auch von der Set-Route (…/stimuli) konsumiert. Reine
 * Konstanten/Schemas/Prüfer, kein DB- oder Storage-Zugriff; die Werte sind
 * byte-identisch zu den vorherigen Modul-Konstanten der Legacy-Route.
 */

export const RESEARCH_STIMULI_BUCKET = "research-stimuli";

// 4 MB statt der Bucket-5-MB: der Bild-Upload reist als multipart DURCH die
// Route, und Vercel-Functions kappen Request-Bodies bei 4,5 MB — ein 5-MB-Cap
// wäre auf Prod nie erreichbar gewesen (413 vor dem Handler).
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// Video-Stimulus: das Video selbst kommt per Signed-Upload DIREKT in den
// Bucket (Bucket erzwingt video/mp4 + 100 MB, Migration 20260703000008) —
// die Routen bekommen nur den storagePath plus die clientseitig extrahierten
// Keyframes. Die Frames sind ein reines Transport-Artefakt (werden analysiert,
// nie persistiert) und müssen mit JSON-Overhead unter dem 4,5-MB-Body-Limit
// bleiben → Gesamt-Cap 3,5M Zeichen.
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const VIDEO_CONTENT_TYPE = "video/mp4";
export const MAX_VIDEO_FRAMES = 16;
export const MAX_FRAME_BASE64_CHARS = 300_000;
export const MAX_TOTAL_FRAME_BASE64_CHARS = 3_500_000;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export const VideoFrameSchema = z.object({
  index: z.number().int().min(0).max(10_000),
  timestampSeconds: z
    .number()
    .finite()
    .min(0)
    .max(60 * 60),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z
    .string()
    .min(32)
    .max(MAX_FRAME_BASE64_CHARS)
    .regex(BASE64_RE, "Frame data must be raw base64 without a data-URL prefix."),
});

/** superRefine-Helfer für den Frame-Gesamt-Cap — beide Routen hängen ihn an
 *  ihr jeweiliges Body-Schema (der Pfad ["frames"] ist Teil des Kontrakts). */
export function refineFramesTotalCap(
  frames: Array<{ data: string }>,
  ctx: z.RefinementCtx,
): void {
  const total = frames.reduce((sum, frame) => sum + frame.data.length, 0);
  if (total > MAX_TOTAL_FRAME_BASE64_CHARS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["frames"],
      message: "Frame payload is too large.",
    });
  }
}

export function parseHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function hasValidImageSignature(file: Blob): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  if (file.type === "image/png") {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return png.every((byte, index) => bytes[index] === byte);
  }

  if (file.type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (file.type === "image/webp") {
    return (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }

  return false;
}

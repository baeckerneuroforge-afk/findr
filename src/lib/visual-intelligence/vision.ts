import "server-only";

import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type Anthropic from "@anthropic-ai/sdk";

import { CLAUDE_MODELS, getAnthropicClient } from "@/lib/anthropic/client";
import { VISUAL_OBSERVATIONS_HEADING } from "@/lib/product-discovery/prompts";

const execFileAsync = promisify(execFile);

export const DEFAULT_VISUAL_CAPTURE_MODEL = CLAUDE_MODELS.sonnet;
export const DEFAULT_SAMPLE_EVERY_SECONDS = 8;
export const DEFAULT_MAX_VISUAL_FRAMES = 24;

export interface VisualFrameSample {
  index: number;
  timestampSeconds: number;
  path: string;
}

export interface BrowserVisualFrameInput {
  index: number;
  timestampSeconds: number;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
}

export interface VisualCapturePayload {
  version: 1;
  captureSource: "manual_file" | "browser_screen";
  generatedAt: string;
  model: string;
  fileName: string;
  sampledEverySeconds: number;
  frameCount: number;
  truncated?: boolean;
  frames: Array<{
    index: number;
    timestampSeconds: number;
  }>;
  observations: string[];
  textBlock: string;
}

export interface VisualCaptureOptions {
  sampleEverySeconds?: number;
  maxFrames?: number;
  model?: string;
}

function assertPositiveInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function stripDataUrlPrefix(data: string): string {
  return data.replace(/^data:image\/(?:jpeg|png|webp);base64,/i, "").trim();
}

function assertBase64ImageData(data: string): string {
  const stripped = stripDataUrlPrefix(data);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(stripped)) {
    throw new Error("Frame data must be a base64-encoded image.");
  }
  return stripped;
}

async function ensureReadableFile(filePath: string): Promise<void> {
  const s = await stat(filePath).catch(() => null);
  if (!s || !s.isFile()) {
    throw new Error(`Recording file not found or not a file: ${filePath}`);
  }
}

export async function sampleVideoFrames(
  filePath: string,
  options: Pick<VisualCaptureOptions, "sampleEverySeconds" | "maxFrames"> = {},
): Promise<{ dir: string; frames: VisualFrameSample[] }> {
  const sampleEverySeconds =
    options.sampleEverySeconds ?? DEFAULT_SAMPLE_EVERY_SECONDS;
  const maxFrames = options.maxFrames ?? DEFAULT_MAX_VISUAL_FRAMES;
  assertPositiveInt(sampleEverySeconds, "sampleEverySeconds");
  assertPositiveInt(maxFrames, "maxFrames");

  await ensureReadableFile(filePath);
  const dir = await mkdtemp(path.join(tmpdir(), "findr-vi-frames-"));
  const outputPattern = path.join(dir, "frame-%04d.jpg");

  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        filePath,
        "-vf",
        `fps=1/${sampleEverySeconds},scale=1280:-2:force_original_aspect_ratio=decrease`,
        "-frames:v",
        String(maxFrames),
        "-q:v",
        "3",
        outputPattern,
      ],
      { maxBuffer: 1024 * 1024 * 4 },
    );
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to sample video frames with ffmpeg. Ensure ffmpeg is installed and the file is readable. Detail: ${detail}`,
    );
  }

  const files = (await readdir(dir))
    .filter((name) => /^frame-\d+\.jpg$/.test(name))
    .sort();

  const frames = files.map((name, i) => ({
    index: i,
    timestampSeconds: i * sampleEverySeconds,
    path: path.join(dir, name),
  }));

  if (frames.length === 0) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw new Error("ffmpeg produced no frames from the recording.");
  }

  return { dir, frames };
}

function normalizeObservationLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^```/.test(line))
    .map((line) => line.replace(/^\d+\.\s*/, "- ").trim())
    .map((line) => (line.startsWith("- ") ? line : `- ${line}`));
}

async function frameToImageBlock(
  frame: VisualFrameSample,
): Promise<Anthropic.ImageBlockParam> {
  const data = await readFile(frame.path, "base64");
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: "image/jpeg",
      data,
    },
  };
}

function browserFrameToImageBlock(
  frame: BrowserVisualFrameInput,
): Anthropic.ImageBlockParam {
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: frame.mediaType,
      data: assertBase64ImageData(frame.data),
    },
  };
}

async function describeFrames(
  frames: VisualFrameSample[],
  model: string,
): Promise<string[]> {
  const content: Anthropic.MessageParam["content"] = [
    {
      type: "text",
      text: [
        "You are reviewing sampled frames from a user research recording.",
        "Return concise German bullet points only.",
        "Report only visible, product-relevant observations from screens or product interaction.",
        "Do not infer emotion, intent, identity, health, protected attributes, or business impact.",
        "Do not invent UI states that are not visible. If a frame is unclear, say it is unclear.",
        "Prefix each useful bullet with the approximate timestamp in [mm:ss].",
      ].join("\n"),
    },
  ];

  for (const frame of frames) {
    content.push({
      type: "text",
      text: `Frame ${frame.index + 1}, approx [${formatTimestamp(
        frame.timestampSeconds,
      )}]`,
    });
    content.push(await frameToImageBlock(frame));
  }

  const client = getAnthropicClient();
  const response = await client.messages.create(
    {
      model,
      max_tokens: 1200,
      system:
        "You produce grounded visual observation notes for a downstream extraction pipeline. Be literal, conservative, and concise.",
      messages: [{ role: "user", content }],
    },
    { timeout: 120_000, maxRetries: 1 },
  );

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return normalizeObservationLines(text);
}

async function describeBrowserFrames(
  frames: BrowserVisualFrameInput[],
  model: string,
): Promise<string[]> {
  const content: Anthropic.MessageParam["content"] = [
    {
      type: "text",
      text: [
        "You are reviewing sampled frames from a browser screen-share in a user research interview.",
        "Return concise German bullet points only.",
        "Report only visible, product-relevant observations from screens or product interaction.",
        "Do not infer emotion, intent, identity, health, protected attributes, or business impact.",
        "Do not invent UI states that are not visible. If a frame is unclear, say it is unclear.",
        "Prefix each useful bullet with the approximate timestamp in [mm:ss].",
      ].join("\n"),
    },
  ];

  for (const frame of frames) {
    content.push({
      type: "text",
      text: `Frame ${frame.index + 1}, approx [${formatTimestamp(
        frame.timestampSeconds,
      )}]`,
    });
    content.push(browserFrameToImageBlock(frame));
  }

  const client = getAnthropicClient();
  const response = await client.messages.create(
    {
      model,
      max_tokens: 1200,
      system:
        "You produce grounded visual observation notes for a downstream extraction pipeline. Be literal, conservative, and concise.",
      messages: [{ role: "user", content }],
    },
    { timeout: 120_000, maxRetries: 1 },
  );

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return normalizeObservationLines(text);
}

function buildVisualTextBlock(params: {
  fileName: string;
  model: string;
  sampledEverySeconds: number;
  frameCount: number;
  observations: string[];
  sourceLine?: string;
  truncated?: boolean;
}): string {
  const lines = params.observations.length
    ? params.observations
    : ["- Keine produktrelevanten visuellen Beobachtungen in den Frames."];

  return [
    VISUAL_OBSERVATIONS_HEADING,
    "VISUAL_CAPTURE_START",
    `Source: ${params.sourceLine ?? `manual_file (${params.fileName})`}`,
    `Model: ${params.model}`,
    `Sampling: 1 frame every ${params.sampledEverySeconds}s, ${params.frameCount} frame(s) total`,
    ...(params.truncated
      ? ["Scope: Nur der erste Teil wurde ausgewertet; weitere Frames wurden am Limit abgeschnitten."]
      : []),
    ...lines,
    "VISUAL_CAPTURE_END",
  ].join("\n");
}

export async function createVisualCaptureFromRecording(
  filePath: string,
  options: VisualCaptureOptions = {},
): Promise<VisualCapturePayload> {
  const sampleEverySeconds =
    options.sampleEverySeconds ?? DEFAULT_SAMPLE_EVERY_SECONDS;
  const maxFrames = options.maxFrames ?? DEFAULT_MAX_VISUAL_FRAMES;
  const model = options.model ?? DEFAULT_VISUAL_CAPTURE_MODEL;

  const { dir, frames } = await sampleVideoFrames(filePath, {
    sampleEverySeconds,
    maxFrames,
  });

  try {
    const observations = await describeFrames(frames, model);
    const fileName = path.basename(filePath);
    const textBlock = buildVisualTextBlock({
      fileName,
      model,
      sampledEverySeconds: sampleEverySeconds,
      frameCount: frames.length,
      observations,
    });

    return {
      version: 1,
      captureSource: "manual_file",
      generatedAt: new Date().toISOString(),
      model,
      fileName,
      sampledEverySeconds: sampleEverySeconds,
      frameCount: frames.length,
      frames: frames.map((frame) => ({
        index: frame.index,
        timestampSeconds: frame.timestampSeconds,
      })),
      observations,
      textBlock,
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function createVisualCaptureFromBrowserFrames(
  frames: BrowserVisualFrameInput[],
  options: VisualCaptureOptions & { truncated?: boolean } = {},
): Promise<VisualCapturePayload> {
  const sampleEverySeconds =
    options.sampleEverySeconds ?? DEFAULT_SAMPLE_EVERY_SECONDS;
  const maxFrames = options.maxFrames ?? DEFAULT_MAX_VISUAL_FRAMES;
  const model = options.model ?? DEFAULT_VISUAL_CAPTURE_MODEL;
  assertPositiveInt(sampleEverySeconds, "sampleEverySeconds");
  assertPositiveInt(maxFrames, "maxFrames");

  if (frames.length === 0) {
    throw new Error("At least one browser frame is required.");
  }

  const cappedFrames = frames
    .slice(0, maxFrames)
    .map((frame, index) => ({
      ...frame,
      index,
    }));

  const observations = await describeBrowserFrames(cappedFrames, model);
  const fileName = "browser-screen";
  const truncated = Boolean(options.truncated || frames.length > maxFrames);
  const textBlock = buildVisualTextBlock({
    fileName,
    model,
    sampledEverySeconds: sampleEverySeconds,
    frameCount: cappedFrames.length,
    observations,
    sourceLine: "browser_screen",
    truncated,
  });

  return {
    version: 1,
    captureSource: "browser_screen",
    generatedAt: new Date().toISOString(),
    model,
    fileName,
    sampledEverySeconds: sampleEverySeconds,
    frameCount: cappedFrames.length,
    truncated,
    frames: cappedFrames.map((frame) => ({
      index: frame.index,
      timestampSeconds: frame.timestampSeconds,
    })),
    observations,
    textBlock,
  };
}

export function visualCaptureToTranscriptBlock(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const capture = value as Record<string, unknown>;
  if (typeof capture.textBlock === "string") {
    const block = capture.textBlock.trim();
    return block.startsWith(VISUAL_OBSERVATIONS_HEADING) ? block : null;
  }

  const observations = capture.observations;
  if (!Array.isArray(observations)) return null;
  const lines = observations.filter(
    (line): line is string => typeof line === "string" && line.trim() !== "",
  );
  if (lines.length === 0) return null;

  return [
    VISUAL_OBSERVATIONS_HEADING,
    "VISUAL_CAPTURE_START",
    ...lines.map((line) => (line.trim().startsWith("- ") ? line.trim() : `- ${line.trim()}`)),
    "VISUAL_CAPTURE_END",
  ].join("\n");
}

export function appendVisualCaptureToTranscript(
  transcript: string,
  visualCapture: unknown,
): string {
  const block = visualCaptureToTranscriptBlock(visualCapture);
  if (!block) return transcript;
  const base = transcript.trimEnd();
  if (base.length === 0) return block;
  return `${base}\n\n${block}`;
}

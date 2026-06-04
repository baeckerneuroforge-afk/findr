import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { DEFAULT_LOCALE } from "@/i18n/locale";
import { getResearchPlan } from "@/lib/research/plans-service";
import { findInviteByAccessToken } from "@/lib/research/scheduling";
import type {
  InterviewLanguage,
  InterviewTurn,
} from "@/lib/voice-agent/interviewer";
import {
  getPublicSession,
  loadByToken,
} from "@/lib/voice-agent/session-service";

/**
 * POST /api/interview/[token]/speak
 *
 * Public participant route for TTS Stage 1. It speaks the latest server-owned
 * agent turn in the interview session via Deepgram Aura-2 EU TTS and streams the
 * audio response back to the browser. The request body is intentionally ignored:
 * accepting arbitrary text here would turn this capability URL into an open TTS
 * spend/exfiltration endpoint.
 */

export const maxDuration = 300;

const DEEPGRAM_SPEAK_URL = "https://api.eu.deepgram.com/v1/speak";
const DEEPGRAM_TTS_MODEL = "aura-2-aurelia-de";
const DEEPGRAM_TTS_ENCODING = "mp3";
const MAX_DEEPGRAM_TTS_CHARS = 2000;
const TokenSchema = z.string().min(20).max(200);

type SpeakableSession = {
  kind: "post_loss" | "checkin" | "research";
  orgId: string;
  planId: string | null;
  language: InterviewLanguage;
  conversation: InterviewTurn[];
};

class DeepgramTtsError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

function findLastAgentTurn(
  conversation: InterviewTurn[],
): { index: number; text: string } | null {
  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const turn = conversation[index];
    if (turn?.role !== "agent") continue;
    const text = typeof turn.text === "string" ? turn.text.trim() : "";
    if (text !== "") return { index, text };
  }
  return null;
}

function extractDeepgramError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["err_msg", "error", "message"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

async function readDeepgramError(response: Response): Promise<string | null> {
  const raw = await response.text().catch(() => "");
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as unknown;
    return extractDeepgramError(payload) ?? raw.slice(0, 500);
  } catch {
    return raw.slice(0, 500);
  }
}

function normalizeAudioContentType(contentType: string | null): string | null {
  if (!contentType) return "audio/mpeg";
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mediaType.startsWith("audio/")) return contentType;
  if (mediaType === "application/octet-stream") return "audio/mpeg";
  return null;
}

async function synthesizeWithDeepgram(text: string): Promise<{
  bytes: ArrayBuffer;
  contentType: string;
  headers: Headers;
}> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new DeepgramTtsError("DEEPGRAM_API_KEY is not configured.", 500);
  }

  const url = new URL(DEEPGRAM_SPEAK_URL);
  url.searchParams.set("model", DEEPGRAM_TTS_MODEL);
  url.searchParams.set("encoding", DEEPGRAM_TTS_ENCODING);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const detail = await readDeepgramError(response);
    throw new DeepgramTtsError(
      detail
        ? `Deepgram TTS failed with status ${response.status}: ${detail}`
        : `Deepgram TTS failed with status ${response.status}.`,
    );
  }

  const contentType = normalizeAudioContentType(
    response.headers.get("content-type"),
  );
  if (!contentType) {
    const detail = await readDeepgramError(response);
    throw new DeepgramTtsError(
      detail
        ? `Deepgram TTS returned a non-audio response: ${detail}`
        : "Deepgram TTS returned a non-audio response.",
    );
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) {
    throw new DeepgramTtsError("Deepgram TTS returned an empty audio response.");
  }

  return { bytes, contentType, headers: response.headers };
}

function audioResponse(audio: {
  bytes: ArrayBuffer;
  contentType: string;
  headers: Headers;
}): Response {
  const headers = new Headers({
    "Content-Type": audio.contentType,
    "Cache-Control": "no-store",
  });
  for (const key of ["dg-request-id", "dg-model-name", "dg-char-count"]) {
    const value = audio.headers.get(key);
    if (value) headers.set(key, value);
  }
  return new Response(audio.bytes, { status: 200, headers });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const tokenParsed = TokenSchema.safeParse(token);
  if (!tokenParsed.success) {
    const t = await getTranslations("errors");
    return NextResponse.json(
      { error: t("interview.invalidLink") },
      { status: 400 },
    );
  }

  const accessToken = tokenParsed.data;
  const existing = await loadByToken(accessToken);
  const locale = existing?.language ?? DEFAULT_LOCALE;
  let t = await getTranslations({ locale, namespace: "errors" });
  let session: SpeakableSession | null = existing;

  if (existing) {
    if (existing.kind !== "research" || !existing.planId) {
      return NextResponse.json(
        { error: "TTS is only available for research interviews." },
        { status: 403 },
      );
    }

    const plan = await getResearchPlan(existing.orgId, existing.planId);
    if (!plan) {
      return NextResponse.json({ error: t("notFound.interview") }, { status: 404 });
    }
    if (plan.ttsEnabled !== true) {
      return NextResponse.json(
        { error: "TTS is not enabled for this study." },
        { status: 403 },
      );
    }
  } else {
    const invite = await findInviteByAccessToken(accessToken);
    const inviteLocale = invite?.language ?? DEFAULT_LOCALE;
    const inviteT = await getTranslations({
      locale: inviteLocale,
      namespace: "errors",
    });
    if (!invite || !invite.org_id) {
      return NextResponse.json(
        { error: inviteT("notFound.interview") },
        { status: 404 },
      );
    }

    const plan = await getResearchPlan(invite.org_id, invite.plan_id);
    if (!plan) {
      return NextResponse.json(
        { error: inviteT("notFound.interview") },
        { status: 404 },
      );
    }
    if (plan.ttsEnabled !== true) {
      return NextResponse.json(
        { error: "TTS is not enabled for this study." },
        { status: 403 },
      );
    }
    if (plan.screeningQuestions.length > 0) {
      return NextResponse.json(
        { error: inviteT("notFound.interview") },
        { status: 404 },
      );
    }

    const createdSession = await getPublicSession(accessToken);
    if (!createdSession) {
      return NextResponse.json(
        { error: inviteT("notFound.interview") },
        { status: 404 },
      );
    }
    session = createdSession;
  }

  // Future UI versions may add a turn index/hash guard to avoid stale playback
  // after rapid navigation. This version deliberately speaks only the latest
  // session-owned agent turn and accepts no caller-provided text.
  const turn = findLastAgentTurn(session?.conversation ?? []);
  if (!turn) {
    return NextResponse.json(
      { error: "No agent message is available to speak." },
      { status: 422 },
    );
  }
  if (turn.text.length > MAX_DEEPGRAM_TTS_CHARS) {
    return NextResponse.json(
      { error: "Agent message exceeds the Deepgram TTS character limit." },
      { status: 422 },
    );
  }

  try {
    const audio = await synthesizeWithDeepgram(turn.text);
    return audioResponse(audio);
  } catch (err) {
    if (err instanceof DeepgramTtsError) {
      console.error("[interview speak] Deepgram TTS failed:", err.message);
      return NextResponse.json(
        { error: "Could not synthesize speech.", detail: err.message },
        { status: err.status },
      );
    }
    console.error(
      "[interview speak] Deepgram TTS failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "Could not synthesize speech." },
      { status: 502 },
    );
  }
}

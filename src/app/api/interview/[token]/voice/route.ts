import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { DEFAULT_LOCALE } from "@/i18n/locale";
import { sttLanguageCode } from "@/lib/voice-agent/deepgram-language";
import { getResearchPlan } from "@/lib/research/plans-service";
import { findInviteByAccessToken } from "@/lib/research/scheduling";
import { VoiceUnavailableError } from "@/lib/voice-agent/interviewer";
import {
  advanceInterview,
  getPublicSession,
  loadByToken,
} from "@/lib/voice-agent/session-service";

/**
 * POST /api/interview/[token]/voice
 *
 * Public participant route for Voice Stage 1. It accepts one raw audio body,
 * transcribes it synchronously via Deepgram EU STT, and feeds the transcript
 * into advanceInterview(token, text), the same seam used by typed chat.
 */

export const maxDuration = 300;

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const DEEPGRAM_LISTEN_URL = "https://api.eu.deepgram.com/v1/listen";
const TokenSchema = z.string().min(20).max(200);

type DeepgramListenResponse = {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: unknown;
      }>;
    }>;
  };
};

class RequestPayloadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

class DeepgramTranscriptionError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

function isSupportedAudioContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return (
    mediaType.startsWith("audio/") || mediaType === "application/octet-stream"
  );
}

async function readRawAudio(request: NextRequest): Promise<{
  bytes: ArrayBuffer;
  contentType: string;
}> {
  const contentType = request.headers.get("content-type");
  if (!isSupportedAudioContentType(contentType)) {
    throw new RequestPayloadError(
      "Expected a raw audio request body with an audio/* Content-Type.",
      400,
    );
  }

  const rawContentLength = request.headers.get("content-length");
  if (rawContentLength) {
    const contentLength = Number(rawContentLength);
    if (!Number.isFinite(contentLength) || contentLength < 0) {
      throw new RequestPayloadError("Invalid Content-Length header.", 400);
    }
    if (contentLength > MAX_AUDIO_BYTES) {
      throw new RequestPayloadError("Audio payload exceeds the 10 MB limit.", 413);
    }
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) {
    throw new RequestPayloadError("Audio payload is empty.", 400);
  }
  if (bytes.byteLength > MAX_AUDIO_BYTES) {
    throw new RequestPayloadError("Audio payload exceeds the 10 MB limit.", 413);
  }

  return {
    bytes,
    contentType: contentType ?? "application/octet-stream",
  };
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

function extractTranscript(payload: unknown): string {
  const channels = (payload as DeepgramListenResponse | null)?.results?.channels;
  if (!Array.isArray(channels)) return "";

  return channels
    .map((channel) => {
      const transcript = channel.alternatives?.[0]?.transcript;
      return typeof transcript === "string" ? transcript.trim() : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function transcribeWithDeepgram(
  input: {
    bytes: ArrayBuffer;
    contentType: string;
  },
  language: string,
): Promise<string> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new DeepgramTranscriptionError("DEEPGRAM_API_KEY is not configured.", 500);
  }

  const url = new URL(DEEPGRAM_LISTEN_URL);
  url.searchParams.set("model", "nova-3");
  // Per-Studie-Sprache (F2): EN-Studien dürfen nicht zwangsweise auf Deutsch
  // transkribiert werden. nova-3 akzeptiert "de"/"en" direkt; "de" bleibt der
  // Default, wenn keine Sprache aufgelöst werden kann.
  url.searchParams.set("language", sttLanguageCode(language));
  // Nova-3 uses `keyterm`, not `keywords`, for vocabulary prompting.
  // See Deepgram Keyterm Prompting docs for the current parameter name.
  url.searchParams.append("keyterm", "Klymeo");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": input.contentType,
    },
    body: input.bytes,
  });

  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new DeepgramTranscriptionError(
        `Deepgram returned a non-JSON response with status ${response.status}.`,
      );
    }
  }

  if (!response.ok) {
    const detail = extractDeepgramError(payload);
    throw new DeepgramTranscriptionError(
      detail
        ? `Deepgram STT failed with status ${response.status}: ${detail}`
        : `Deepgram STT failed with status ${response.status}.`,
    );
  }

  return extractTranscript(payload);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
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
  // Effektive Interviewsprache für die Deepgram-STT (F2). Für eine bestehende
  // Session aus der Session-Row, sonst aus dem Invite (s. else-Zweig).
  let interviewLanguage: string = existing?.language ?? DEFAULT_LOCALE;
  let t = await getTranslations({ locale, namespace: "errors" });

  if (existing) {
    if (!existing.planId) {
      return NextResponse.json(
        { error: "Voice is only available for research interviews." },
        { status: 403 },
      );
    }

    const plan = await getResearchPlan(existing.orgId, existing.planId);
    if (!plan) {
      return NextResponse.json({ error: t("notFound.interview") }, { status: 404 });
    }
    if (plan.voiceEnabled !== true) {
      return NextResponse.json(
        { error: "Voice is not enabled for this study." },
        { status: 403 },
      );
    }
  } else {
    const invite = await findInviteByAccessToken(accessToken);
    const inviteLocale = invite?.language ?? DEFAULT_LOCALE;
    interviewLanguage = inviteLocale;
    const inviteT = await getTranslations({
      locale: inviteLocale,
      namespace: "errors",
    });
    t = inviteT;
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
    if (plan.voiceEnabled !== true) {
      return NextResponse.json(
        { error: "Voice is not enabled for this study." },
        { status: 403 },
      );
    }
    if (plan.screeningQuestions.length > 0) {
      return NextResponse.json(
        { error: inviteT("notFound.interview") },
        { status: 404 },
      );
    }
  }

  let audio: { bytes: ArrayBuffer; contentType: string };
  try {
    audio = await readRawAudio(request);
  } catch (err) {
    if (err instanceof RequestPayloadError) {
      return NextResponse.json(
        { error: t("invalidRequestBody"), detail: err.message },
        { status: err.status },
      );
    }
    throw err;
  }

  if (!existing) {
    const createdSession = await getPublicSession(accessToken);
    if (!createdSession) {
      return NextResponse.json(
        { error: t("notFound.interview") },
        { status: 404 },
      );
    }
  }

  let transcript: string;
  try {
    transcript = await transcribeWithDeepgram(audio, interviewLanguage);
  } catch (err) {
    if (err instanceof DeepgramTranscriptionError) {
      console.error("[interview voice] Deepgram STT failed:", err.message);
      // Public participant route: the raw Deepgram message stays server-side.
      return NextResponse.json(
        { error: "Could not transcribe audio." },
        { status: err.status },
      );
    }
    console.error(
      "[interview voice] Deepgram STT failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "Could not transcribe audio." },
      { status: 502 },
    );
  }

  if (transcript.trim() === "") {
    return NextResponse.json(
      { error: "Deepgram returned an empty transcript." },
      { status: 422 },
    );
  }

  try {
    const session = await advanceInterview(accessToken, transcript);
    if (!session) {
      return NextResponse.json(
        { error: t("notFound.interview") },
        { status: 404 },
      );
    }
    // Strip server-only orgId before exposing the session to the public client.
    const { orgId: _orgId, ...publicSession } = session;
    return NextResponse.json({ session: publicSession });
  } catch (err) {
    if (err instanceof VoiceUnavailableError) {
      return NextResponse.json(
        {
          error: t("interview.assistantUnavailable"),
        },
        { status: 502 },
      );
    }
    console.error(
      "[interview voice] advance failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: t("unexpected") }, { status: 500 });
  }
}

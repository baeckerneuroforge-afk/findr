import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { VoiceUnavailableError } from "@/lib/voice-agent/interviewer";
import {
  advanceInterview,
  getPublicSession,
} from "@/lib/voice-agent/session-service";

/**
 * PUBLIC, login-free interview endpoints. No org/auth check by design — access
 * is granted solely by possession of the unguessable access_token in the URL.
 * Everything runs server-side via the service-role-backed session service, which
 * only ever touches the single session matching the token (see session-service
 * security note). Tokens are validated for shape before any lookup.
 */

const TokenSchema = z.string().min(20).max(200);
const MessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const t = await getTranslations("errors");
  const { token } = await params;
  const parsed = TokenSchema.safeParse(token);
  if (!parsed.success) {
    return NextResponse.json({ error: t("interview.invalidLink") }, { status: 400 });
  }

  const session = await getPublicSession(parsed.data);
  if (!session) {
    return NextResponse.json({ error: t("notFound.interview") }, { status: 404 });
  }
  // orgId is server-only (white-label branding resolution); never expose the
  // internal org UUID on this public, login-free endpoint.
  const { orgId: _orgId, ...publicSession } = session;
  return NextResponse.json({ session: publicSession });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tokenParsed = TokenSchema.safeParse(token);
  if (!tokenParsed.success) {
    // Pre-session (malformed token): no language signal yet → default locale.
    const t = await getTranslations("errors");
    return NextResponse.json(
      { error: t("interview.invalidLink") },
      { status: 400 },
    );
  }

  // Participant-facing locale = the session's interview language (resolved from
  // the token), NOT the UI cookie: participants are login-free and carry none.
  const existing = await getPublicSession(tokenParsed.data);
  const t = await getTranslations({
    locale: existing?.language ?? DEFAULT_LOCALE,
    namespace: "errors",
  });
  if (!existing) {
    return NextResponse.json({ error: t("notFound.interview") }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = MessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const session = await advanceInterview(tokenParsed.data, parsed.data.message);
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
          error:
            t("interview.assistantUnavailable"),
        },
        { status: 502 },
      );
    }
    console.error(
      `[interview] advance failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("unexpected") },
      { status: 500 },
    );
  }
}

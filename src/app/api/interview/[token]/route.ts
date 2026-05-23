import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
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
  const { token } = await params;
  const parsed = TokenSchema.safeParse(token);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  const session = await getPublicSession(parsed.data);
  if (!session) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }
  return NextResponse.json({ session });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tokenParsed = TokenSchema.safeParse(token);
  if (!tokenParsed.success) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = MessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const session = await advanceInterview(tokenParsed.data, parsed.data.message);
    if (!session) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ session });
  } catch (err) {
    if (err instanceof VoiceUnavailableError) {
      return NextResponse.json(
        {
          error:
            "The interview assistant is unavailable right now. Please try again in a moment.",
        },
        { status: 502 },
      );
    }
    console.error(
      `[interview] advance failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

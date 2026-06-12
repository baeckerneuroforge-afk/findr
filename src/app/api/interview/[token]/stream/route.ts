import { type NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { VoiceUnavailableError } from "@/lib/voice-agent/interviewer";
import {
  advanceInterview,
  ensureOpeningTurn,
  getPublicSession,
} from "@/lib/voice-agent/session-service";

/**
 * PUBLIC, login-free STREAMING interview endpoint (Perf-Etappe B1/B2) —
 * the SSE sibling of POST /api/interview/[token]. Same security model:
 * access is granted solely by possession of the unguessable access_token;
 * everything runs through the service-role-backed session service scoped to
 * that one token.
 *
 * Request body:
 *   { message: string }  → advance the conversation by one turn (B1)
 *   {}                   → ensure the OPENING turn exists (B2; idempotent —
 *                          an already-opened session replies `final` only,
 *                          no LLM call)
 *
 * Event protocol (SSE):
 *   show   { position }  → E4 Multi-Stimulus: reveal stimulus <position>
 *                          NOW (sent before the turn's deltas; only ever
 *                          emitted for sessions whose plan carries a
 *                          stimulus set)
 *   delta  { text }      → participant-visible message chars, in order
 *   final  { session }   → the persisted, authoritative public session view
 *                          (identical shape to the non-streaming route) —
 *                          ALWAYS the last word; clients must replace their
 *                          local transcript with it
 *   error  { error }     → terminal, participant-displayable message
 *
 * Failures BEFORE the stream opens (bad token, bad body, unknown session)
 * stay plain JSON status responses so clients can branch on res.ok. Once the
 * stream is open the status is committed (200) — failures travel as `error`
 * events instead.
 */

// LLM-Turn-Route: ein Opus-Turn kann inkl. Retry deutlich über Vercels
// 60s-Hobby-Default liegen — gleiche Begründung wie auf den übrigen
// LLM-Routen (Etappe A), gleicher Wert.
export const maxDuration = 300;

const TokenSchema = z.string().min(20).max(200);
const BodySchema = z.object({
  message: z.string().trim().min(1).max(4000).optional(),
});

const encoder = new TextEncoder();

function sseChunk(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tokenParsed = TokenSchema.safeParse(token);
  if (!tokenParsed.success) {
    const t = await getTranslations("errors");
    return NextResponse.json(
      { error: t("interview.invalidLink") },
      { status: 400 },
    );
  }

  // Participant-facing locale = the session's interview language (resolved
  // from the token), NOT the UI cookie — mirrors the non-streaming route.
  const existing = await getPublicSession(tokenParsed.data);
  const t = await getTranslations({
    locale: existing?.language ?? DEFAULT_LOCALE,
    namespace: "errors",
  });
  if (!existing) {
    return NextResponse.json({ error: t("notFound.interview") }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const message = parsed.data.message;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // A participant closing the tab mid-turn cancels the stream; enqueue
      // then throws. The turn itself MUST still run to completion so the
      // conversation persists (the client recovers it via GET on reload) —
      // so every send is fire-and-forget against a possibly-closed
      // controller.
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(sseChunk(event, data));
        } catch {
          closed = true;
        }
      };

      try {
        const onDelta = (text: string) => send("delta", { text });
        // E4 Multi-Stimulus — Reveal-Signal VOR den Text-Deltas: das Panel
        // wechselt, bevor die zugehörige Frage einläuft (Dramaturgie). Wert
        // ist server-seitig bereits gegen das Set geklemmt; Sessions ohne
        // Set feuern nie → Event-Strom byte-identisch zu vorher.
        const onShow = (position: number) => send("show", { position });
        const session = message
          ? await advanceInterview(tokenParsed.data, message, onDelta, onShow)
          : await ensureOpeningTurn(tokenParsed.data, onDelta, onShow);

        if (!session) {
          send("error", { error: t("notFound.interview") });
        } else {
          // Strip server-only orgId before exposing the session — same
          // serialization as the non-streaming route.
          const { orgId: _orgId, ...publicSession } = session;
          send("final", { session: publicSession });
        }
      } catch (err) {
        if (err instanceof VoiceUnavailableError) {
          send("error", { error: t("interview.assistantUnavailable") });
        } else {
          console.error(
            "[interview stream] turn failed:",
            err instanceof Error ? err.message : err,
          );
          send("error", { error: t("unexpected") });
        }
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            // already cancelled by the client — nothing to release
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // Proxy-Puffer (nginx & Co.) explizit aus — sonst kommen die Deltas
      // gebündelt statt live an.
      "X-Accel-Buffering": "no",
    },
  });
}

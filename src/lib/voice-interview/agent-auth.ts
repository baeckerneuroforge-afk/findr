import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Voice-Interview Phase 1 — Shared-Secret-Auth für die AGENT-seitigen
 * Bridge-Routes (/api/voice/session-context, /api/voice/transcript,
 * /api/voice/complete).
 *
 * Der Caller ist der externe LiveKit-Voice-Agent-Worker (ein vertrauens-
 * würdiger Python-Backend-Dienst), KEIN Browser und KEIN Teilnehmer. Er
 * authentifiziert sich mit einem einzigen statischen Shared Secret aus env
 * (VOICE_AGENT_SHARED_SECRET) via `Authorization: Bearer <secret>`. Die
 * discriminated-union-Rückgabe ({ ok } | { error }) spiegelt
 * requireOrgIdFromBearer (src/lib/auth/voice-token.ts), damit die Routes
 * exakt wie die bestehende Ingest-Auth lesen.
 *
 * THREAT MODEL: Wer das Secret besitzt, gilt als interne Infrastruktur und
 * darf Sessions per UUID adressieren (die Routes geben System-Prompt +
 * Konversation heraus bzw. schreiben Transkripte). Das Secret ist daher wie
 * der SUPABASE_SERVICE_ROLE_KEY zu behandeln: nur server-zu-server, nie im
 * Client, nie im Log.
 *
 * Der Vergleich ist timing-sicher: beide Seiten werden zuerst sha256-gehasht
 * (gleiche Länge garantiert), dann via crypto.timingSafeEqual verglichen —
 * kein Längen-Leak, kein Early-Exit-Vergleich.
 */

function extractBearer(headers: Headers): string | null {
  const raw = headers.get("authorization");
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m ? m[1].trim() : null;
}

function sha256(input: string): Buffer {
  return createHash("sha256").update(input).digest();
}

/**
 * Prüft den Bearer-Header gegen VOICE_AGENT_SHARED_SECRET.
 *
 *   503 — Secret nicht konfiguriert (Route ist dann bewusst tot; es gibt
 *         KEINEN unauthentifizierten Fallback).
 *   401 — Header fehlt oder Secret stimmt nicht überein.
 */
export function requireVoiceAgentAuth(request: {
  headers: Headers;
}): { ok: true } | { error: NextResponse } {
  const secret = process.env.VOICE_AGENT_SHARED_SECRET;
  if (!secret || secret.trim() === "") {
    return {
      error: NextResponse.json(
        { error: "Voice agent bridge is not configured." },
        { status: 503 },
      ),
    };
  }

  const presented = extractBearer(request.headers);
  if (!presented) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized.", code: "no_auth" },
        { status: 401 },
      ),
    };
  }

  if (!timingSafeEqual(sha256(presented), sha256(secret))) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized.", code: "no_auth" },
        { status: 401 },
      ),
    };
  }

  return { ok: true };
}

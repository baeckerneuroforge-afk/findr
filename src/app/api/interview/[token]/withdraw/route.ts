import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { withdrawSessionByToken } from "@/lib/voice-agent/session-service";

// Gleiche Format-Validierung wie die Schwester-Routen (stream/speak/voice):
// ein offensichtlich ungeformter Token (leer/zu kurz/zu lang) löst gar keine
// DB-Query aus. Härtungs-Konsistenz, kein Verhaltenswechsel für echte Tokens.
const TokenSchema = z.string().min(20).max(200);

/**
 * POST /api/interview/[token]/withdraw — DSGVO-Selbstwiderruf (G6).
 *
 * Der Teilnehmer löscht seine eigene Interview-Session über den unguessbaren
 * 256-bit access_token. Haltung wie die übrigen /api/interview/[token]/* Routen:
 *   - Capability-Auth: der Token IST die Berechtigung; kein Login, keine weitere
 *     Identität.
 *   - Body wird komplett IGNORIERT.
 *   - Idempotent & kein Orakel: ob eine Session existierte oder nicht, die
 *     Antwort ist 200 {success:true} — ein Dritter mit geratenem Token erfährt
 *     nichts über Sessionzustand.
 *   - Fehler (DB) → 500.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tokenParsed = TokenSchema.safeParse(token);
  if (!tokenParsed.success) {
    return NextResponse.json(
      { success: false, error: "invalid_token" },
      { status: 400 },
    );
  }
  try {
    await withdrawSessionByToken(tokenParsed.data);
    return NextResponse.json({ success: true });
  } catch (err) {
    // Public participant route: DB error text stays server-side; the client
    // only needs the stable failure code.
    console.error(
      "[interview withdraw] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "withdraw_failed" },
      { status: 500 },
    );
  }
}

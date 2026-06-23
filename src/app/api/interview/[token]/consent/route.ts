import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  CONSENT_TEXT_VERSION,
  loadByToken,
  markSessionConsentByToken,
} from "@/lib/voice-agent/session-service";

/**
 * POST /api/interview/[token]/consent — E0 Recht & Offenlegung.
 *
 * Stempelt die Teilnehmer-Einwilligung auf eine BESTEHENDE Session (Invite-Pfad:
 * post_loss / checkin / research ohne Screening). Der Open-Link- und der
 * needs_screening-Pfad laufen NICHT hierüber — dort existiert zum Consent-
 * Zeitpunkt noch keine Session-Row; das consentAccepted-Flag reist im
 * jeweiligen screen-POST mit und wird bei Session-Creation gestempelt.
 *
 * Sicherheits-/Datenschutz-Haltung (Muster der übrigen /api/interview/[token]/*
 * Routen):
 *   - Capability-Auth: der unguessbare 256-bit access_token IST die Berechtigung;
 *     kein Login, keine weitere Identität.
 *   - Der Request-BODY ist optional. Ohne Body / ohne `purposes` ist die Route
 *     byte-identisch zu vorher: nichts Client-Geliefertes wird persistiert, der
 *     Zeitstempel entsteht server-seitig (markSessionConsentByToken). Phase 2a:
 *     ein optionales `{ purposes: ('events'|'replay'|'screen')[] }` stempelt
 *     zusätzlich die granularen Tier-Consents — server-seitig gestempelt; der
 *     Client signalisiert nur, WELCHE Tiers zugestimmt wurden.
 *   - Idempotent: nur der ERSTE Accept schreibt (WHERE consent_accepted_at IS
 *     NULL); Wiederholungen sind No-ops mit identischer Antwort.
 *   - Antwort ist 204 OHNE Body: über diesen Endpoint verlassen keinerlei
 *     Session-Daten den Server (kein Orakel über Sessionzustand hinaus).
 *   - Fail-open fürs Interview: schlägt der Stempel fehl (z. B. Migration
 *     20260704000001 noch nicht angewandt), wird geloggt und trotzdem 204
 *     geantwortet — das UI-Gate hat Offenlegung + aktive Bestätigung bereits
 *     erzwungen; ein Teilnehmer wird durch einen Persistenzfehler nie
 *     ausgesperrt.
 */

const TokenSchema = z.string().min(20).max(200);

// Phase 2a — optional granular capture-consent tiers. Absent body / absent
// purposes → the base E0 path below (byte-identical). The enum mirrors
// CaptureTier (no affect tier — structural red line, integration plan L8).
const BodySchema = z.object({
  purposes: z.array(z.enum(["events", "replay", "screen"])).max(3).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tokenParsed = TokenSchema.safeParse(token);
  if (!tokenParsed.success) {
    return new NextResponse(null, { status: 400 });
  }

  const session = await loadByToken(tokenParsed.data);
  if (!session) {
    return new NextResponse(null, { status: 404 });
  }

  // Optional tiers — defensively parsed; a missing/invalid body yields no
  // purposes, and the byte-identical base path runs unchanged.
  const rawBody = await req.json().catch(() => null);
  const parsedBody = BodySchema.safeParse(rawBody);
  const purposes =
    parsedBody.success && parsedBody.data.purposes?.length
      ? parsedBody.data.purposes
      : undefined;

  if (purposes) {
    // Arch-6 fix: a tier may be granted AFTER the baseline accept — stamp the
    // per-purpose tier(s) ALWAYS, independent of status / consentAcceptedAt
    // (each tier is idempotent on its own column). markSessionConsentByToken
    // also (re)stamps the baseline when still open+unstamped (idempotent no-op
    // otherwise), so a first-contact accept-with-purposes records both.
    await markSessionConsentByToken(
      tokenParsed.data,
      CONSENT_TEXT_VERSION,
      purposes,
    );
  } else if (session.status === "open" && session.consentAcceptedAt === null) {
    // Base path — byte-identical to before: only open, not-yet-stamped sessions
    // write; everything else is an idempotent no-op (same 204, no state oracle).
    await markSessionConsentByToken(tokenParsed.data, CONSENT_TEXT_VERSION);
  }

  return new NextResponse(null, { status: 204 });
}

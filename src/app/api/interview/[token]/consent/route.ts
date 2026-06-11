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
 *   - Der Request-BODY wird komplett IGNORIERT — nichts Client-Geliefertes wird
 *     persistiert; der Zeitstempel entsteht server-seitig
 *     (markSessionConsentByToken).
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

export async function POST(
  _req: NextRequest,
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

  // Nur offene, noch nicht gestempelte Sessions schreiben; alles andere ist ein
  // idempotenter No-op (gleiche 204 — keine Zustands-Orakel nach außen).
  if (session.status === "open" && session.consentAcceptedAt === null) {
    await markSessionConsentByToken(tokenParsed.data, CONSENT_TEXT_VERSION);
  }

  return new NextResponse(null, { status: 204 });
}

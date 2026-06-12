import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { DEFAULT_LOCALE } from "@/i18n/locale";
import { getResearchPlan } from "@/lib/research/plans-service";
import { findInviteByAccessToken } from "@/lib/research/scheduling";
import {
  getPublicSession,
  loadByToken,
  markSessionVoiceModeById,
} from "@/lib/voice-agent/session-service";
import {
  getLiveKitVoiceEnv,
  mintParticipantVoiceToken,
} from "@/lib/voice-interview/livekit";

/**
 * POST /api/voice/token — Voice-Interview Phase 1 (TEILNEHMER-seitig).
 *
 * PUBLIC, login-frei — authentifiziert über die BESTEHENDE Teilnehmer-
 * Session-Mechanik: Zugriff gewährt allein der Besitz des unguessbaren
 * access_token (Body-Feld `token`, gleicher 256-bit-Capability-Kontrakt wie
 * /api/interview/[token]). Gating + Reihenfolge spiegeln die bestehende
 * Voice-STT-Route /api/interview/[token]/voice 1:1:
 *
 *   - bestehende Session  → planId-Pflicht (research-only) → Plan laden →
 *     plan.voiceEnabled !== true → 403.
 *   - noch keine Session  → Invite auflösen → Plan laden → voiceEnabled →
 *     Screening-Gate (Fragen konfiguriert → 404, Session entsteht NUR über
 *     POST /api/interview/[token]/screen) → lazy-create via getPublicSession
 *     (inkl. Opening-Message + Race-Backstop, identisch zum Text-Einstieg).
 *
 * SPEND-BRAKE: Die max_sessions-Bremse offener Studien-Links sitzt VOR der
 * Session-Erstellung (POST /api/interview/open/[token]/screen) — jede
 * Session, die diese Route erreicht, hat die Bremse strukturell bereits
 * passiert; eine zweite Prüfung hier würde nur laufende, legitime Sessions
 * aussperren.
 *
 * Antwort: { serverUrl, roomName, token } — Raum deterministisch
 * voice-<sessionId>, Token-TTL kurz (10 min), RoomConfiguration mit
 * Agent-Dispatch (VOICE_AGENT_NAME), Grants: roomJoin + canPublish +
 * canSubscribe + canPublishData. Nach erfolgreichem Mint wird die Session
 * idempotent als mode='voice' gestempelt (Pricing-Fundament — der Mint ist
 * der Agent-Dispatch-Moment).
 *
 * Surface:
 *   400 — non-JSON / ungültiger Body / Token-Form ungültig
 *   404 — Token unbekannt ODER Screening noch nicht bestanden
 *   403 — kein research-Interview ODER voice für die Studie nicht aktiviert
 *   409 — Session nicht mehr offen
 *   503 — LiveKit-Env unvollständig (LIVEKIT_URL/_API_KEY/_API_SECRET,
 *         VOICE_AGENT_NAME)
 *   500 — unerwartet
 *   200 — { serverUrl, roomName, token }
 */

// Lazy-create kann eine Opus-Opening-Message anstoßen — gleiche Begründung
// wie maxDuration in /api/interview/[token]/voice, nur ohne STT-Anteil.
export const maxDuration = 60;

const TokenSchema = z.string().min(20).max(200);
const TokenBodySchema = z.object({
  token: TokenSchema,
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    const t = await getTranslations("errors");
    return NextResponse.json({ error: t("invalidJsonBody") }, { status: 400 });
  }

  const parsed = TokenBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const t = await getTranslations("errors");
    return NextResponse.json(
      { error: t("invalidRequestBody"), detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const accessToken = parsed.data.token;

  try {
    // ── Gating-Spiegel von /api/interview/[token]/voice ──────────────────────
    const existing = await loadByToken(accessToken);
    const locale = existing?.language ?? DEFAULT_LOCALE;
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
        return NextResponse.json(
          { error: t("notFound.interview") },
          { status: 404 },
        );
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

    // ── Session sicherstellen (lazy-create identisch zum Text-Einstieg) ──────
    let session = existing;
    if (!session) {
      const created = await getPublicSession(accessToken);
      if (!created) {
        return NextResponse.json(
          { error: t("notFound.interview") },
          { status: 404 },
        );
      }
      // getPublicSession liefert die id-lose Public-View — für den
      // Raum-Namen brauchen wir die Session-UUID, daher einmal nachlesen.
      session = await loadByToken(accessToken);
      if (!session) {
        return NextResponse.json(
          { error: t("notFound.interview") },
          { status: 404 },
        );
      }
    }

    if (session.status !== "open") {
      return NextResponse.json(
        {
          error: "Interview session is no longer open.",
          code: "not_open",
          status: session.status,
        },
        { status: 409 },
      );
    }

    // ── LiveKit-Token minten ──────────────────────────────────────────────────
    const env = getLiveKitVoiceEnv();
    if (!env) {
      return NextResponse.json(
        { error: "Voice interviews are not configured." },
        { status: 503 },
      );
    }

    const minted = await mintParticipantVoiceToken(env, session.id);
    // Pricing-Fundament: der Mint ist der Moment, ab dem LiveKit den Agent
    // dispatcht (Kosten beginnen) — Session als Voice markieren. Idempotent
    // + best-effort (blockiert den Teilnehmer nie); reine ?mode=text-
    // Fallback-Teilnehmer holen nie einen Token und bleiben mode='text'.
    await markSessionVoiceModeById(session.id);
    return NextResponse.json(minted);
  } catch (err) {
    console.error(
      "[POST /api/voice/token] failed:",
      err instanceof Error ? err.message : err,
    );
    const t = await getTranslations("errors");
    return NextResponse.json({ error: t("unexpected") }, { status: 500 });
  }
}

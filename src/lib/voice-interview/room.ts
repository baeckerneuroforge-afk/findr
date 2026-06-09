import "server-only";

/**
 * Voice-Interview Phase 1 — Raum-Namens-Kontrakt.
 *
 * Ein LiveKit-Raum ist deterministisch an genau EINE interview_session
 * gebunden: `voice-<sessionId>`. Die Teilnehmer-Token-Route mintet Tokens nur
 * für diesen Namen, die Agent-Routen lösen ihn zurück zur Session auf. Eigene
 * Datei (ohne livekit-server-sdk-Import), damit die Agent-Routen die reine
 * String-Logik ziehen können, ohne das SDK in ihr Bundle zu holen.
 */

export const VOICE_ROOM_PREFIX = "voice-";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function voiceRoomName(sessionId: string): string {
  return `${VOICE_ROOM_PREFIX}${sessionId}`;
}

/** `voice-<uuid>` → `<uuid>`, sonst null (striktes Format, kein Trimmen). */
export function sessionIdFromRoomName(room: string): string | null {
  if (!room.startsWith(VOICE_ROOM_PREFIX)) return null;
  const candidate = room.slice(VOICE_ROOM_PREFIX.length);
  return UUID_RE.test(candidate) ? candidate : null;
}

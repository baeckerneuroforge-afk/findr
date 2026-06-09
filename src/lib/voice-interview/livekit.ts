import "server-only";

import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
} from "livekit-server-sdk";

import { voiceRoomName } from "./room";

/**
 * Voice-Interview Phase 1 — LiveKit-Token-Ausgabe (Teilnehmer-Seite).
 *
 * Mintet ein kurzlebiges Join-Token für den session-gebundenen Raum
 * `voice-<sessionId>` und hängt die RoomConfiguration mit explizitem
 * Agent-Dispatch an: LiveKit startet beim Raum-Join automatisch den
 * registrierten Voice-Agent-Worker (VOICE_AGENT_NAME — muss dem agent_name
 * des Python-LiveKit-Dienstes entsprechen). Der Worker holt sich seinen
 * Interview-Kontext dann selbst über GET /api/voice/session-context.
 *
 * TTL bewusst kurz (10 min): das Token ist nur die EINTRITTSKARTE in den
 * Raum — eine bestehende Verbindung lebt unabhängig von der Token-TTL
 * weiter. Läuft das Token vor dem Join ab, holt der Client einfach ein
 * neues über POST /api/voice/token (idempotent, gleicher Raum).
 */

export interface LiveKitVoiceEnv {
  serverUrl: string;
  apiKey: string;
  apiSecret: string;
  agentName: string;
}

/** Alle vier Variablen müssen gesetzt sein, sonst null (Route → 503). */
export function getLiveKitVoiceEnv(): LiveKitVoiceEnv | null {
  const serverUrl = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  const agentName = process.env.VOICE_AGENT_NAME?.trim();
  if (!serverUrl || !apiKey || !apiSecret || !agentName) return null;
  return { serverUrl, apiKey, apiSecret, agentName };
}

const VOICE_TOKEN_TTL = "10m";

export interface ParticipantVoiceToken {
  serverUrl: string;
  roomName: string;
  token: string;
}

export async function mintParticipantVoiceToken(
  env: LiveKitVoiceEnv,
  sessionId: string,
): Promise<ParticipantVoiceToken> {
  const roomName = voiceRoomName(sessionId);

  const at = new AccessToken(env.apiKey, env.apiSecret, {
    identity: `participant-${sessionId}`,
    ttl: VOICE_TOKEN_TTL,
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  at.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: env.agentName })],
  });

  return {
    serverUrl: env.serverUrl,
    roomName,
    token: await at.toJwt(),
  };
}

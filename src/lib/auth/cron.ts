import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Shared Bearer-CRON_SECRET check for the /api/cron/* routes.
 *
 * Same timing-safe comparison core as requireVoiceAgentAuth
 * (src/lib/voice-interview/agent-auth.ts): both sides are sha256-hashed
 * first (guaranteed equal length, no length leak), then compared via
 * crypto.timingSafeEqual — no early-exit string comparison.
 *
 * Fail-closed: no CRON_SECRET configured → never authorized.
 */
function sha256(input: string): Buffer {
  return createHash("sha256").update(input).digest();
}

export function isAuthorizedCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const raw = request.headers.get("authorization");
  if (!raw) return false;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  if (!match) return false;

  return timingSafeEqual(sha256(match[1].trim()), sha256(cronSecret));
}

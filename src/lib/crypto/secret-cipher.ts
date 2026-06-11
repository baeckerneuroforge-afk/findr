import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Symmetric encryption for third-party credentials stored at rest (HubSpot /
 * Gong OAuth tokens, Slack webhook URLs). AES-256-GCM, mirroring the panel
 * provider-credential scheme (lib/panel/credentials.ts) and sharing its key —
 * both encrypt the same class of secret (third-party access credentials), so a
 * single managed key keeps key hygiene simple and needs no new prod env var.
 *
 * Unlike the panel table (dedicated iv / auth_tag / ciphertext columns), these
 * secrets live in pre-existing TEXT columns, so the ciphertext is packed into
 * ONE self-describing string:
 *
 *   enc:v1:<base64 iv>:<base64 authTag>:<base64 ciphertext>
 *
 * The `enc:v1:` prefix lets a read distinguish ciphertext from a legacy
 * plaintext value. `decryptSecret` passes un-prefixed values through unchanged,
 * so rows written before the backfill keep working with zero downtime; the
 * one-time backfill script (scripts/encrypt-integration-tokens.ts) re-encrypts
 * them, and every write path encrypts going forward.
 */

const ENCRYPTION_KEY_ENV = "PANEL_CREDENTIALS_ENCRYPTION_KEY";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const PREFIX = "enc:v1:";

function readEncryptionKey(): Buffer {
  const raw = process.env[ENCRYPTION_KEY_ENV];
  if (!raw) {
    throw new Error(
      `${ENCRYPTION_KEY_ENV} is not set. Required to encrypt/decrypt integration credentials.`,
    );
  }

  const trimmed = raw.trim();
  const base64 = Buffer.from(trimmed, "base64");
  if (base64.length === KEY_BYTES) return base64;

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  const utf8 = Buffer.from(trimmed, "utf8");
  if (utf8.length === KEY_BYTES) return utf8;

  throw new Error(
    `${ENCRYPTION_KEY_ENV} must decode to exactly 32 bytes (base64, hex, or 32-byte utf8).`,
  );
}

/** True when `value` is one of our `enc:v1:` ciphertext strings. */
export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Encrypt a secret into a self-describing `enc:v1:<iv>:<tag>:<ciphertext>` string. */
export function encryptSecret(plaintext: string): string {
  const key = readEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // base64 never contains ':', so colon-splitting on read is unambiguous.
  return [
    PREFIX + iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Decrypt an `enc:v1:` string back to plaintext. A value WITHOUT the prefix is
 * treated as legacy plaintext and returned unchanged — this is what makes the
 * rollout safe before the backfill runs. Throws on a malformed ciphertext
 * (prefixed but structurally wrong / tampered), never silently returning junk.
 */
export function decryptSecret(value: string): string {
  if (!isEncryptedSecret(value)) return value;

  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted secret: expected iv:tag:ciphertext");
  }
  const [ivB64, tagB64, ciphertextB64] = parts;

  const key = readEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

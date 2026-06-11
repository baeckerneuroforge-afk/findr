import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./secret-cipher";

// 32-char ascii → read as a 32-byte utf8 key by the module's key reader.
const TEST_KEY = "0123456789abcdef0123456789abcdef";

describe("secret-cipher", () => {
  beforeEach(() => {
    vi.stubEnv("PANEL_CREDENTIALS_ENCRYPTION_KEY", TEST_KEY);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips a secret through encrypt → decrypt", () => {
    const secret = "hubspot-access-token-äöü-🔐";
    const encrypted = encryptSecret(secret);

    expect(encrypted).not.toContain(secret);
    expect(encrypted.startsWith("enc:v1:")).toBe(true);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("flags ciphertext vs. plaintext", () => {
    expect(isEncryptedSecret(encryptSecret("x"))).toBe(true);
    expect(isEncryptedSecret("plain-token")).toBe(false);
  });

  it("passes legacy plaintext through unchanged (pre-backfill safety)", () => {
    expect(decryptSecret("legacy-plaintext-token")).toBe(
      "legacy-plaintext-token",
    );
  });

  it("produces distinct ciphertext per call (random IV) but a stable plaintext", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same");
    expect(decryptSecret(b)).toBe("same");
  });

  it("throws on a structurally malformed ciphertext", () => {
    expect(() => decryptSecret("enc:v1:onlyonepart")).toThrow(/malformed/i);
  });

  it("throws on a tampered ciphertext (GCM auth tag mismatch)", () => {
    const encrypted = encryptSecret("secret");
    // flip the last char of the ciphertext segment
    const tampered = encrypted.slice(0, -1) + (encrypted.at(-1) === "A" ? "B" : "A");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws when the encryption key is not configured", () => {
    vi.stubEnv("PANEL_CREDENTIALS_ENCRYPTION_KEY", "");
    expect(() => encryptSecret("x")).toThrow(/PANEL_CREDENTIALS_ENCRYPTION_KEY/);
  });
});

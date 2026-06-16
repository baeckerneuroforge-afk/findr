import { beforeEach, describe, expect, it } from "vitest";
import {
  __clearTtsCacheForTests,
  getCachedTts,
  setCachedTts,
  ttsCacheKey,
} from "./tts-cache";

function bytes(n: number): ArrayBuffer {
  return new Uint8Array([n]).buffer;
}

describe("ttsCacheKey", () => {
  it("is stable for the same inputs and never contains the raw token", () => {
    const token = "super-secret-access-token-1234567890";
    const key = ttsCacheKey(token, 4, "de");
    expect(key).toBe(ttsCacheKey(token, 4, "de"));
    expect(key).not.toContain(token);
  });

  it("differs by turn index, language, and token", () => {
    const a = ttsCacheKey("tok-a", 1, "de");
    expect(a).not.toBe(ttsCacheKey("tok-a", 2, "de"));
    expect(a).not.toBe(ttsCacheKey("tok-a", 1, "en"));
    expect(a).not.toBe(ttsCacheKey("tok-b", 1, "de"));
  });
});

describe("TTS cache get/set", () => {
  beforeEach(() => __clearTtsCacheForTests());

  it("returns undefined on a miss and the value on a hit", () => {
    const key = ttsCacheKey("tok", 0, "de");
    expect(getCachedTts(key)).toBeUndefined();
    setCachedTts(key, { bytes: bytes(1), contentType: "audio/mpeg" });
    expect(getCachedTts(key)?.contentType).toBe("audio/mpeg");
  });

  it("evicts the least-recently-used entry beyond the cap", () => {
    // Cap is 64; insert 65 distinct keys → the first inserted is evicted.
    const first = ttsCacheKey("tok", 0, "de");
    setCachedTts(first, { bytes: bytes(0), contentType: "audio/mpeg" });
    for (let i = 1; i <= 64; i += 1) {
      setCachedTts(ttsCacheKey("tok", i, "de"), {
        bytes: bytes(i),
        contentType: "audio/mpeg",
      });
    }
    expect(getCachedTts(first)).toBeUndefined();
    expect(getCachedTts(ttsCacheKey("tok", 64, "de"))).toBeDefined();
  });

  it("spares a recently-read entry and evicts an untouched one (LRU)", () => {
    // Fill the cache to exactly the cap (keys tok:0 … tok:63).
    for (let i = 0; i < 64; i += 1) {
      setCachedTts(ttsCacheKey("tok", i, "de"), {
        bytes: bytes(i),
        contentType: "audio/mpeg",
      });
    }
    // Touch the oldest entry so it becomes most-recently-used.
    expect(getCachedTts(ttsCacheKey("tok", 0, "de"))).toBeDefined();
    // One more insert forces a single eviction: the now-oldest UNTOUCHED entry
    // (tok:1) goes, while the touched tok:0 survives.
    setCachedTts(ttsCacheKey("tok", 64, "de"), {
      bytes: bytes(64),
      contentType: "audio/mpeg",
    });
    expect(getCachedTts(ttsCacheKey("tok", 0, "de"))).toBeDefined();
    expect(getCachedTts(ttsCacheKey("tok", 1, "de"))).toBeUndefined();
  });
});

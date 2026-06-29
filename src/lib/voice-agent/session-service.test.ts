import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createResearchSupabase } from "@/lib/research/db";
import {
  CONSENT_TEXT_VERSION,
  consentTextVersion,
  markSessionConsentByToken,
} from "./session-service";

vi.mock("@/lib/research/db", () => ({ createResearchSupabase: vi.fn() }));

const mockCreate = vi.mocked(createResearchSupabase);

/** Chainable stub for `.from(...).update(...).eq(...).is(...)` (awaited). The
 *  shared update/eq/is mocks capture every call across the base + tier writes. */
function makeSupabase(isError: unknown = null) {
  const is = vi.fn().mockResolvedValue({ error: isError });
  const eq = vi.fn(() => ({ is }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { client: { from } as never, from, update, eq, is };
}

describe("consentTextVersion (Konsoul-aware DSGVO Art. 7(1) stamp)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("flag OFF (unset/empty): returns the unchanged base CONSENT_TEXT_VERSION", () => {
    vi.stubEnv("NEXT_PUBLIC_KONSOUL_INTERVIEWER_PERSONA", "");
    expect(consentTextVersion()).toBe(CONSENT_TEXT_VERSION);
  });

  it("flag ON: stamps a DISTINCT Konsoul version (so the proof matches the shown wording)", () => {
    vi.stubEnv("NEXT_PUBLIC_KONSOUL_INTERVIEWER_PERSONA", "true");
    expect(consentTextVersion()).not.toBe(CONSENT_TEXT_VERSION);
    expect(consentTextVersion()).toMatch(/konsoul/);
  });
});

describe("markSessionConsentByToken (Phase 2a tier stamps, L4)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("base path (no purposes): one idempotent E0 stamp, no tier writes (byte-identical)", async () => {
    const sb = makeSupabase();
    mockCreate.mockReturnValue(sb.client);

    await markSessionConsentByToken("tok", "v1");

    expect(sb.update).toHaveBeenCalledTimes(1);
    expect(sb.update).toHaveBeenCalledWith(
      expect.objectContaining({ consent_version: "v1" }),
    );
    // Idempotency guard: only the FIRST accept writes.
    expect(sb.is).toHaveBeenCalledWith("consent_accepted_at", null);
  });

  it("with purposes: stamps each tier on its OWN column, idempotent per tier", async () => {
    const sb = makeSupabase();
    mockCreate.mockReturnValue(sb.client);

    await markSessionConsentByToken("tok", "v2", ["screen", "events"]);

    // Base E0 stamp + one update per tier.
    expect(sb.update).toHaveBeenCalledTimes(3);
    // Each tier guarded on its OWN column → can be granted after the baseline.
    expect(sb.is).toHaveBeenCalledWith("consent_accepted_at", null);
    expect(sb.is).toHaveBeenCalledWith("screen_consent_at", null);
    expect(sb.is).toHaveBeenCalledWith("events_consent_at", null);
    // Tier writes pin the instrumentation version (Art. 7(1)).
    expect(sb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        screen_consent_at: expect.any(String),
        instrumentation_consent_version: "v2",
      }),
    );
    expect(sb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        events_consent_at: expect.any(String),
        instrumentation_consent_version: "v2",
      }),
    );
    // Red line: a tier write never touches the (now-removed, reserved) replay
    // column — it isn't a tier anymore and must never be stamped implicitly.
    expect(sb.is).not.toHaveBeenCalledWith("replay_consent_at", null);
  });

  it("is best-effort: a tier-stamp DB error is logged, not thrown", async () => {
    const sb = makeSupabase({ message: "column does not exist" });
    mockCreate.mockReturnValue(sb.client);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      markSessionConsentByToken("tok", "v3", ["screen"]),
    ).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

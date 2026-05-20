import { describe, expect, it } from "vitest";
import { MultiThreadingFailureDetector } from "./multi-threading-failure";
import { makeCall, makeInput } from "./test-helpers";

describe("MultiThreadingFailureDetector", () => {
  const detector = new MultiThreadingFailureDetector();

  it("detects explicit single-threaded access", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Bitte nur noch ueber mir, CFO und Legal sind aktuell nicht dabei." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
    expect(result.signals[0]?.type).toBe("multi_threading_failure");
  });

  it("detects stakeholder coverage collapse", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { speaker_id: "a", text: "Hallo." },
          { speaker_id: "b", text: "Hallo." },
          { speaker_id: "c", text: "Hallo." },
        ]),
        makeCall("call_2", "2026-04-08T10:00:00.000Z", [
          { speaker_id: "d", text: "Hallo." },
          { speaker_id: "e", text: "Hallo." },
        ]),
        makeCall("call_3", "2026-04-15T10:00:00.000Z", [
          { speaker_id: "a", text: "Nur ich bin heute dabei." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
  });

  it("detects missing backup champion", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { text: "Wir haben noch keinen Backup-Champion fuer den Fall, dass Anna ausfaellt." },
        ]),
      ]),
    );

    expect(result.detected).toBe(true);
  });

  it("does not flag healthy multi-threaded access", async () => {
    const result = await detector.detect(
      makeInput([
        makeCall("call_1", "2026-04-01T10:00:00.000Z", [
          { speaker_id: "finance", text: "Finance ist eingebunden." },
          { speaker_id: "legal", text: "Legal prueft parallel." },
          { speaker_id: "champion", speaker_role: "champion", text: "Ich koordiniere intern." },
        ]),
      ]),
    );

    expect(result.detected).toBe(false);
  });
});


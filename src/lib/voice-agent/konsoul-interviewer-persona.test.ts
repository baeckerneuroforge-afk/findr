import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isKonsoulInterviewerFaceEnabled,
  isKonsoulInterviewerPersonaEnabled,
} from "./konsoul-interviewer-persona";

/**
 * Flag-Semantik der Konsoul-Interviewer-Flags: AUSSCHLIESSLICH der exakte Wert
 * "true" aktiviert (unset / "false" / "0" / "TRUE" / "1" ⇒ AUS), und die zwei
 * Flags (Persona-Name vs. Gesicht/Visual) sind voneinander UNABHÄNGIG — so kann
 * das Gesicht separat scharfgeschaltet werden, ohne den Namen zu berühren.
 */
const OFF_VALUES = ["", "false", "0", "TRUE", "1", "yes"];

afterEach(() => vi.unstubAllEnvs());

describe("Konsoul interviewer flags", () => {
  it("persona flag: only the exact string \"true\" enables it", () => {
    vi.stubEnv("NEXT_PUBLIC_KONSOUL_INTERVIEWER_PERSONA", "true");
    expect(isKonsoulInterviewerPersonaEnabled()).toBe(true);
    for (const v of OFF_VALUES) {
      vi.stubEnv("NEXT_PUBLIC_KONSOUL_INTERVIEWER_PERSONA", v);
      expect(isKonsoulInterviewerPersonaEnabled()).toBe(false);
    }
  });

  it("face flag: only the exact string \"true\" enables it", () => {
    vi.stubEnv("NEXT_PUBLIC_KONSOUL_INTERVIEWER_FACE", "true");
    expect(isKonsoulInterviewerFaceEnabled()).toBe(true);
    for (const v of OFF_VALUES) {
      vi.stubEnv("NEXT_PUBLIC_KONSOUL_INTERVIEWER_FACE", v);
      expect(isKonsoulInterviewerFaceEnabled()).toBe(false);
    }
  });

  it("the two flags are independent (face on, persona off — and vice versa)", () => {
    vi.stubEnv("NEXT_PUBLIC_KONSOUL_INTERVIEWER_FACE", "true");
    vi.stubEnv("NEXT_PUBLIC_KONSOUL_INTERVIEWER_PERSONA", "");
    expect(isKonsoulInterviewerFaceEnabled()).toBe(true);
    expect(isKonsoulInterviewerPersonaEnabled()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_KONSOUL_INTERVIEWER_FACE", "");
    vi.stubEnv("NEXT_PUBLIC_KONSOUL_INTERVIEWER_PERSONA", "true");
    expect(isKonsoulInterviewerFaceEnabled()).toBe(false);
    expect(isKonsoulInterviewerPersonaEnabled()).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { endedPollOutcome } from "./voice-end-outcome";

/**
 * Regression — der „Verbindung unterbrochen"-Fehler beim Beenden eines Voice-
 * Interviews. Ursache: der ended-Poller löste bei Zeitüberschreitung nur dann zum
 * Dankesscreen auf, wenn ein done-signal kam — ein vom Teilnehmer SELBST beendetes
 * Interview bekommt aber nie ein done-signal, fiel also in den harten Fehler,
 * obwohl die Session server-seitig sauber abschließt. Diese Tests frieren ein:
 * intentional ODER done-signal → "done"; nur der unbeabsichtigte Abbruch → "lost".
 */

describe("endedPollOutcome", () => {
  it("beabsichtigtes Ende ohne done-signal → done (der gemeldete Bug-Fall)", () => {
    expect(
      endedPollOutcome({ sawDoneSignal: false, intentionalClose: true }),
    ).toBe("done");
  });

  it("done-signal ohne intentional → done (natürliches Agenten-Ende)", () => {
    expect(
      endedPollOutcome({ sawDoneSignal: true, intentionalClose: false }),
    ).toBe("done");
  });

  it("beides gesetzt → done", () => {
    expect(
      endedPollOutcome({ sawDoneSignal: true, intentionalClose: true }),
    ).toBe("done");
  });

  it("unbeabsichtigter Abbruch (weder intentional noch done-signal) → lost", () => {
    expect(
      endedPollOutcome({ sawDoneSignal: false, intentionalClose: false }),
    ).toBe("lost");
  });
});

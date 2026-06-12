import { describe, expect, it } from "vitest";

import type { InterviewTurn } from "@/lib/voice-agent/interviewer";
import {
  aggregateStimulusSessions,
  computeSessionStimulusView,
  normalizeStimulusSummary,
} from "./stimuli";

const ITEMS = [
  { position: 1, label: "Variante A", type: "image" },
  { position: 2, label: "Variante B", type: "image" },
  { position: 3, label: null, type: "video" },
];

function agent(text: string, shown?: number): InterviewTurn {
  return shown === undefined
    ? { role: "agent", text }
    : { role: "agent", text, shownStimulusPosition: shown };
}
function customer(text: string): InterviewTurn {
  return { role: "customer", text };
}

/** Volles 3er-Set gesehen, inkl. Vergleich + Präferenzfrage am Ende. */
function fullConversation(): InterviewTurn[] {
  return [
    agent("Willkommen — erzählen Sie kurz von sich?"),
    customer("Gerne."),
    agent("Schauen Sie bitte auf das erste Motiv.", 1),
    customer("Das Blau wirkt sehr frisch."),
    agent("Was genau daran?"),
    customer("Die Kontraste."),
    agent("Nun das zweite Motiv.", 2),
    customer("Wirkt altmodischer auf mich."),
    agent("Und jetzt das dritte.", 3),
    customer("Das Video ist dynamisch."),
    agent("Zurück zum ersten — im Vergleich?", 1),
    customer("Immer noch mein Favorit."),
    agent("Welche Variante bevorzugen Sie insgesamt?"),
    customer("Ganz klar Variante A."),
    agent("Vielen Dank!"),
  ];
}

describe("computeSessionStimulusView", () => {
  it("collects seen positions, first answers and the preference tail", () => {
    const view = computeSessionStimulusView(fullConversation(), 3);
    expect(view.seenPositions).toEqual([1, 2, 3]);
    expect(view.firstAnswers).toEqual([
      { position: 1, answer: "Das Blau wirkt sehr frisch." },
      { position: 2, answer: "Wirkt altmodischer auf mich." },
      { position: 3, answer: "Das Video ist dynamisch." },
    ]);
    // Tail beginnt beim ERSTEN Reveal der höchsten Position (3).
    expect(view.preferenceTail[0]).toEqual({
      role: "agent",
      text: "Und jetzt das dritte.",
    });
    expect(view.preferenceTail.at(-1)).toEqual({
      role: "agent",
      text: "Vielen Dank!",
    });
  });

  it("re-shows do not re-trigger first answers", () => {
    const view = computeSessionStimulusView(fullConversation(), 3);
    expect(
      view.firstAnswers.filter((a) => a.position === 1),
    ).toHaveLength(1);
  });

  it("partial reveal → no preference tail, honest seen list", () => {
    const view = computeSessionStimulusView(
      [
        agent("Erstes Motiv.", 1),
        customer("Ok."),
        agent("Zweites Motiv.", 2),
        customer("Auch ok."),
      ],
      3,
    );
    expect(view.seenPositions).toEqual([1, 2]);
    expect(view.preferenceTail).toEqual([]);
  });

  it("clamps out-of-set markers and ignores marker-less conversations", () => {
    const view = computeSessionStimulusView(
      [agent("Frage?", 7), customer("Antwort."), agent("Noch eine?")],
      3,
    );
    expect(view.seenPositions).toEqual([]);
    expect(view.firstAnswers).toEqual([]);
  });
});

describe("aggregateStimulusSessions", () => {
  const fullView = () => computeSessionStimulusView(fullConversation(), 3);
  const partialView = () =>
    computeSessionStimulusView(
      [agent("Erstes Motiv.", 1), customer("Knapp.")],
      3,
    );

  it("computes server counts and eligible positions (min-N 3)", () => {
    const views = [fullView(), fullView(), fullView(), partialView()];
    const result = aggregateStimulusSessions(views, ITEMS, [1, 1, 2, null]);
    expect(result.summary).toMatchObject({
      setSize: 3,
      totalSessions: 4,
      fullRevealSessions: 3,
      preference: {
        counted: 4,
        votes: [
          { position: 1, count: 2 },
          { position: 2, count: 1 },
          { position: 3, count: 0 },
        ],
        none: 1,
      },
    });
    expect(result.summary?.items.map((i) => i.seenSessions)).toEqual([
      4, 3, 3,
    ]);
    expect(result.block?.eligiblePositions).toEqual([1, 2, 3]);
    expect(
      result.block?.excerpts.find((e) => e.position === 1)?.excerpts,
    ).toContain("Das Blau wirkt sehr frisch.");
  });

  it("below min-N everywhere → summary persists, prompt block stays null", () => {
    const result = aggregateStimulusSessions(
      [fullView(), partialView()],
      ITEMS,
      null,
    );
    expect(result.block).toBeNull();
    expect(result.summary).toMatchObject({
      totalSessions: 2,
      fullRevealSessions: 1,
      preference: null,
    });
  });

  it("empty set → nothing at all", () => {
    expect(aggregateStimulusSessions([fullView()], [], null)).toEqual({
      block: null,
      summary: null,
    });
  });

  it("single-stimulus set never gets preference counts", () => {
    const result = aggregateStimulusSessions(
      [fullView(), fullView(), fullView()],
      [ITEMS[0]],
      [1, 1, 1],
    );
    expect(result.summary?.preference).toBeNull();
  });
});

describe("normalizeStimulusSummary", () => {
  it("round-trips a persisted summary", () => {
    const views = [
      computeSessionStimulusView(fullConversation(), 3),
      computeSessionStimulusView(fullConversation(), 3),
      computeSessionStimulusView(fullConversation(), 3),
    ];
    const { summary } = aggregateStimulusSessions(views, ITEMS, [1, 2, null]);
    expect(normalizeStimulusSummary(JSON.parse(JSON.stringify(summary)))).toEqual(
      summary,
    );
  });

  it.each([null, "x", [], { version: 2 }, { version: 1, items: [] }])(
    "rejects malformed values: %j",
    (value) => {
      expect(normalizeStimulusSummary(value)).toBeNull();
    },
  );
});

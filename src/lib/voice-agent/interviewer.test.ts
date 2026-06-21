import { describe, expect, it } from "vitest";

import {
  buildResearchContext,
  buildResearchSystemPrompt,
  buildResearchTail,
  buildTurnMessages,
  createDoneHeaderParser,
  DEFAULT_RESEARCH_AGENT_CEILING,
  formatDepthDirective,
  formatRoundCeiling,
  formatStimulusSet,
  stimulusSetCeiling,
  stripTurnInternals,
  type InterviewTurn,
  type ResearchInput,
  type ResearchStimulusContext,
} from "./interviewer";

const BASE_INPUT: ResearchInput = {
  plan: {
    title: "Creative-Test",
    objective: "Verständlichkeit der Kampagne prüfen",
    topics: [
      {
        topic: "Erster Eindruck",
        intent: "Spontane Reaktion verstehen",
        hypotheses: ["Die Headline ist unklar"],
      },
    ],
    useCase: "creative_test",
  },
  brand: null,
};

describe("research stimulus prompt wiring", () => {
  it("adds a user-prompt stimulus block from description/type without the URL", () => {
    const prompt = buildResearchContext(
      {
        ...BASE_INPUT,
        plan: {
          ...BASE_INPUT.plan,
          stimulusUrl: "https://figma.example/internal-prototype",
          stimulusType: "link",
          stimulusDescription:
            "Eine Landingpage mit großer Headline und blauem CTA.",
        },
      },
      "de",
    );

    expect(prompt).toContain(
      "STIMULUS:\nDem Teilnehmer wird gerade gezeigt: Eine Landingpage mit großer Headline und blauem CTA. (Typ: Prototyp-Link). Beziehe deine Fragen darauf.",
    );
    const stimulusBlock = prompt.match(/STIMULUS:[\s\S]*?(?=\n\nTOPICS)/)?.[0];
    expect(stimulusBlock).toBeDefined();
    expect(stimulusBlock).not.toContain(
      "https://figma.example/internal-prototype",
    );
    expect(stimulusBlock).not.toContain("Verständlichkeit der Kampagne prüfen");
    expect(stimulusBlock).not.toContain("Die Headline ist unklar");
  });

  it("omits the stimulus block and every asset reference without a description", () => {
    const userPrompt = buildResearchContext(BASE_INPUT, "de");
    const systemPrompt = buildResearchSystemPrompt("creative_test", false);

    expect(userPrompt).not.toContain("STIMULUS:");
    expect(systemPrompt).not.toContain("gezeigten Stimulus");
    expect(systemPrompt).not.toContain("gezeigte Asset");
    expect(systemPrompt).not.toContain("Asset-Anzeige folgt später");
  });

  it("keeps the description-only stimulus block byte-identical when the analysis is null", () => {
    const planWithDescription = {
      ...BASE_INPUT.plan,
      stimulusType: "link",
      stimulusDescription:
        "Eine Landingpage mit großer Headline und blauem CTA.",
    };
    const withoutAnalysisField = buildResearchContext(
      { ...BASE_INPUT, plan: planWithDescription },
      "de",
    );
    const withNullAnalysis = buildResearchContext(
      { ...BASE_INPUT, plan: { ...planWithDescription, stimulusAnalysis: null } },
      "de",
    );

    expect(withNullAnalysis).toBe(withoutAnalysisField);
    expect(withNullAnalysis).not.toContain("STIMULUS-ANALYSE");
  });

  it("appends the vision analysis as Nachhak-Material below the unchanged headline", () => {
    const prompt = buildResearchContext(
      {
        ...BASE_INPUT,
        plan: {
          ...BASE_INPUT.plan,
          stimulusType: "image",
          stimulusDescription: "Anzeige mit blauem CTA.",
          stimulusAnalysis:
            "Layout/Aufbau: Zentrierte Headline über Produktbild\nFarbwelt: Blau-dominant",
        },
      },
      "de",
    );

    expect(prompt).toContain(
      "STIMULUS:\nDem Teilnehmer wird gerade gezeigt: Anzeige mit blauem CTA. (Typ: Bild). Beziehe deine Fragen darauf.",
    );
    expect(prompt).toContain(
      "STIMULUS-ANALYSE (KI-Beschreibung des gezeigten Materials — Nachhak-Material: nutze sie für konkrete Vertiefungen zum Design, sie ERSETZT NICHT die TOPICS):\nLayout/Aufbau: Zentrierte Headline über Produktbild",
    );
  });

  it("renders a generic headline plus analysis when the researcher typed no description", () => {
    const prompt = buildResearchContext(
      {
        ...BASE_INPUT,
        plan: {
          ...BASE_INPUT.plan,
          stimulusType: "image",
          stimulusAnalysis: "Layout/Aufbau: Produktbild mit CTA",
        },
      },
      "de",
    );

    expect(prompt).toContain(
      "STIMULUS:\nDem Teilnehmer wird gerade ein Stimulus gezeigt (Typ: Bild). Beziehe deine Fragen darauf.",
    );
    expect(prompt).toContain("Layout/Aufbau: Produktbild mit CTA");
  });

  it("uses stimulus-specific creative/concept focus only when a stimulus exists", () => {
    expect(buildResearchSystemPrompt("creative_test", true)).toContain(
      "bezogen auf den gezeigten Stimulus",
    );
    expect(buildResearchSystemPrompt("concept_test", true)).toContain(
      "Verständnis des gezeigten Stimulus",
    );
    expect(buildResearchSystemPrompt("concept_test", false)).not.toContain(
      "gezeigten Stimulus",
    );
  });

  it("keeps the JSON output contract on the exported (voice-bridge) prompt", () => {
    // The LiveKit voice bridge ships this prompt verbatim to its agent — the
    // B1 plain-text turn contract must never leak into the exported flavor.
    const prompt = buildResearchSystemPrompt("creative_test", false);
    expect(prompt).toContain("OUTPUT — return ONLY this JSON object");
    expect(prompt).not.toContain("DONE: false");
  });
});

describe("done-header stream parser (B1 plain-text turn contract)", () => {
  it("parses header + message and emits only message chars", () => {
    const parser = createDoneHeaderParser();
    const emitted = [
      parser.push("DONE:"),
      parser.push(" false\n"),
      parser.push("\n"),
      parser.push("Hallo! Wie "),
      parser.push("geht es Ihnen?"),
    ].join("");
    expect(emitted).toBe("Hallo! Wie geht es Ihnen?");
    expect(parser.finish()).toEqual({
      done: false,
      message: "Hallo! Wie geht es Ihnen?",
      why: null,
      showStimulusPosition: null,
    });
  });

  it("parses done: true case-insensitively and with a single newline", () => {
    const parser = createDoneHeaderParser();
    parser.push("done: TRUE\nDanke für das Gespräch!");
    expect(parser.finish()).toEqual({
      done: true,
      message: "Danke für das Gespräch!",
      why: null,
      showStimulusPosition: null,
    });
  });

  it("fails open when the model ignores the contract", () => {
    const parser = createDoneHeaderParser();
    const first = parser.push("Vielen Dank für Ihre Zeit — eine Frage noch:");
    // The whole chunk must become visible the moment it can't be a header.
    expect(first).toBe("Vielen Dank für Ihre Zeit — eine Frage noch:");
    parser.push(" Was war der Auslöser?");
    expect(parser.finish()).toEqual({
      done: false,
      message: "Vielen Dank für Ihre Zeit — eine Frage noch: Was war der Auslöser?",
      why: null,
      showStimulusPosition: null,
    });
  });

  it("fails open on a header-like but invalid first line", () => {
    const parser = createDoneHeaderParser();
    parser.push("DONE: maybe\nText");
    expect(parser.finish().done).toBe(false);
    expect(parser.finish().message).toContain("DONE: maybe");
  });

  it("handles a bare DONE header with no message as empty (caller retries)", () => {
    const parser = createDoneHeaderParser();
    parser.push("DONE: true");
    expect(parser.finish()).toEqual({ done: true, message: "", why: null, showStimulusPosition: null });
  });

  it("tolerates blank lines BEFORE the header (review finding)", () => {
    const parser = createDoneHeaderParser();
    parser.push("\n");
    parser.push("\nDONE: true\n\nDanke!");
    expect(parser.finish()).toEqual({ done: true, message: "Danke!", why: null, showStimulusPosition: null });
  });

  it("emits nothing for the header even when everything arrives in one chunk", () => {
    const parser = createDoneHeaderParser();
    const emitted = parser.push("DONE: true\n\nAuf Wiedersehen!");
    expect(emitted).toBe("Auf Wiedersehen!");
    expect(parser.finish()).toEqual({ done: true, message: "Auf Wiedersehen!", why: null, showStimulusPosition: null });
  });
});

describe("WHY header line (E3 Frage-Rationale)", () => {
  it("parses DONE + WHY + body in one chunk — WHY never reaches the deltas", () => {
    const parser = createDoneHeaderParser();
    const emitted = parser.push(
      "DONE: false\nWHY: Vertiefung zu Thema 2 — Preis wurde erstmals erwähnt\n\nWas genau war zu teuer?",
    );
    expect(emitted).toBe("Was genau war zu teuer?");
    expect(parser.finish()).toEqual({
      done: false,
      message: "Was genau war zu teuer?",
      why: "Vertiefung zu Thema 2 — Preis wurde erstmals erwähnt",
      showStimulusPosition: null,
    });
  });

  it("parses the WHY line across character-level chunks without leaking it", () => {
    const parser = createDoneHeaderParser();
    const raw = "DONE: true\nWHY: Alle Themen gesättigt\n\nVielen Dank!";
    let emitted = "";
    for (const ch of raw) emitted += parser.push(ch);
    expect(emitted).toBe("Vielen Dank!");
    expect(parser.finish()).toEqual({
      done: true,
      message: "Vielen Dank!",
      why: "Alle Themen gesättigt",
      showStimulusPosition: null,
    });
  });

  it("stays byte-identical for the legacy contract without a WHY line", () => {
    const parser = createDoneHeaderParser();
    const emitted = parser.push("DONE: false\n\nWie lief das ab?");
    expect(emitted).toBe("Wie lief das ab?");
    expect(parser.finish()).toEqual({
      done: false,
      message: "Wie lief das ab?",
      why: null,
      showStimulusPosition: null,
    });
  });

  it("streams a body starting with 'Why' instead of swallowing it as a header", () => {
    const parser = createDoneHeaderParser();
    parser.push("DONE: false\n\n");
    const emitted =
      parser.push("Why was that ") + parser.push("frustrating for you?");
    expect(emitted).toBe("Why was that frustrating for you?");
    expect(parser.finish()).toEqual({
      done: false,
      message: "Why was that frustrating for you?",
      why: null,
      showStimulusPosition: null,
    });
  });

  it("treats a bare DONE + WHY with no body as empty message (caller retries)", () => {
    const parser = createDoneHeaderParser();
    parser.push("DONE: true\nWHY: Teilnehmer bat um Abschluss");
    expect(parser.finish()).toEqual({
      done: true,
      message: "",
      why: "Teilnehmer bat um Abschluss",
      showStimulusPosition: null,
    });
  });

  it("caps a runaway WHY value at persistence-safe length", () => {
    const parser = createDoneHeaderParser();
    parser.push(`DONE: false\nWHY: ${"x".repeat(350)}\n\nFrage?`);
    const result = parser.finish();
    expect(result.why?.length).toBe(300);
    expect(result.message).toBe("Frage?");
  });

  it("fails open to body when a WHY-looking line never ends", () => {
    const parser = createDoneHeaderParser();
    parser.push("DONE: false\n");
    const emitted = parser.push(`WHY: ${"y".repeat(450)}`);
    // Über dem Zeilen-Cap ohne Newline → war keine Headerzeile, alles Body.
    expect(emitted.startsWith("WHY: ")).toBe(true);
    expect(parser.finish().why).toBeNull();
  });

  it("swallows a mangled WHY line (prefix garbage) instead of leaking it", () => {
    // Im Opus-Abnahmelauf beobachtet: "WRY-CHECK WHY: …" — die Interna dürfen
    // den Teilnehmer trotzdem NIE erreichen (Müll-Präfix-Toleranz ≤24 Zeichen).
    const parser = createDoneHeaderParser();
    const emitted = parser.push(
      "DONE: false\nWRY-CHECK WHY: Onboarding ohne Signal, wechsle zu Reporting\n\nVerstehe. Lassen Sie uns wechseln.",
    );
    expect(emitted).toBe("Verstehe. Lassen Sie uns wechseln.");
    expect(parser.finish()).toEqual({
      done: false,
      message: "Verstehe. Lassen Sie uns wechseln.",
      why: "Onboarding ohne Signal, wechsle zu Reporting",
      showStimulusPosition: null,
    });
  });

  it("streams a no-separator body once it cannot be a WHY line", () => {
    // Lenient-Altfall: Body direkt nach der DONE-Zeile ohne Leerzeile. Sobald
    // Zeile 2 zu lang für ein WHY-Präfix ist, fließt sie live als Body.
    const parser = createDoneHeaderParser();
    parser.push("DONE: false\n");
    const emitted = parser.push(
      "Können Sie mir das bitte genauer beschreiben?",
    );
    expect(emitted).toBe("Können Sie mir das bitte genauer beschreiben?");
    expect(parser.finish().why).toBeNull();
  });
});

describe("stripTurnInternals (E3 — Teilnehmer-Payload-Hygiene)", () => {
  it("removes why from agent turns and leaves plain turns untouched", () => {
    const conversation: InterviewTurn[] = [
      { role: "agent", text: "Frage?", why: "Einstieg ins leichteste Thema" },
      { role: "customer", text: "Antwort." },
      { role: "agent", text: "Nachfrage?" },
    ];
    expect(stripTurnInternals(conversation)).toEqual([
      { role: "agent", text: "Frage?" },
      { role: "customer", text: "Antwort." },
      { role: "agent", text: "Nachfrage?" },
    ]);
    // Nie ein why-Schlüssel in der Teilnehmer-Form — auch nicht als undefined.
    expect(stripTurnInternals(conversation).some((t) => "why" in t)).toBe(
      false,
    );
  });
});

describe("buildTurnMessages (B4 messages-list + caching layout)", () => {
  const HISTORY: InterviewTurn[] = [
    { role: "agent", text: "Erste Frage?" },
    { role: "customer", text: "Erste Antwort." },
    { role: "agent", text: "Zweite Frage?" },
    { role: "customer", text: "Zweite Antwort." },
  ];

  it("maps history to alternating roles with context first and tail last", () => {
    const messages = buildTurnMessages("KONTEXT", HISTORY, "TAIL");
    expect(messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
    ]);
    const last = messages[messages.length - 1]
      .content as Array<{ type: "text"; text: string }>;
    // Participant answer and volatile tail are SEPARATE blocks on one message.
    expect(last.map((b) => b.text)).toEqual(["Zweite Antwort.", "TAIL"]);
  });

  it("puts the cache breakpoint on the last stable (pre-tail) message", () => {
    const messages = buildTurnMessages("KONTEXT", HISTORY, "TAIL");
    const stable = messages[messages.length - 2]
      .content as Array<{ cache_control?: { type: string } }>;
    expect(stable[stable.length - 1].cache_control).toEqual({
      type: "ephemeral",
    });
    const last = messages[messages.length - 1]
      .content as Array<{ cache_control?: { type: string } }>;
    expect(last.every((b) => b.cache_control === undefined)).toBe(true);
  });

  it("merges consecutive same-role turns to keep strict alternation", () => {
    const messages = buildTurnMessages(
      "KONTEXT",
      [
        { role: "customer", text: "Antwort A." },
        { role: "customer", text: "Antwort B." },
      ],
      "TAIL",
    );
    // context(user) + merged customer turns + tail all collapse to ONE user
    // message — roles stay strictly alternating for the API.
    expect(messages).toHaveLength(1);
    const blocks = messages[0].content as Array<{ text: string }>;
    expect(blocks.map((b) => b.text)).toEqual([
      "KONTEXT",
      "Antwort A.",
      "Antwort B.",
      "TAIL",
    ]);
  });

  it("attaches the tail to the context message on an empty history (opening)", () => {
    const messages = buildTurnMessages("KONTEXT", [], "TAIL");
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    const blocks = messages[0].content as Array<{ text: string }>;
    expect(blocks.map((b) => b.text)).toEqual(["KONTEXT", "TAIL"]);
  });

  it("skips empty-text turns the API would reject", () => {
    const messages = buildTurnMessages(
      "KONTEXT",
      [
        { role: "agent", text: "   " },
        { role: "customer", text: "Echte Antwort." },
      ],
      "TAIL",
    );
    expect(messages.map((m) => m.role)).toEqual(["user"]);
  });
});

// ─── Multi-Stimulus E4 ───────────────────────────────────────────────────────

function setItem(
  overrides: Partial<ResearchStimulusContext>,
): ResearchStimulusContext {
  return {
    position: 1,
    type: "image",
    url: "https://storage.example/s1.png",
    label: "Variante A",
    description: "Blaues Packaging",
    analysis: null,
    ...overrides,
  };
}

function setInput(stimuli: ResearchStimulusContext[]): ResearchInput {
  return {
    ...BASE_INPUT,
    plan: { ...BASE_INPUT.plan, stimuli },
  };
}

const TWO_SET = [
  setItem({}),
  setItem({ position: 2, label: "Variante B", url: "https://storage.example/s2.png" }),
];

describe("createDoneHeaderParser — SHOW header (E4)", () => {
  function feed(chunks: string[]) {
    const parser = createDoneHeaderParser();
    let emitted = "";
    for (const chunk of chunks) emitted += parser.push(chunk);
    return { result: parser.finish(), emitted };
  }

  it("parses DONE + WHY + SHOW and never emits any header as delta", () => {
    const { result, emitted } = feed([
      "DONE: false\nWHY: Wechsel zu Variante B.\nSHOW: 2\n\nWie wirkt dieses Bild auf Sie?",
    ]);
    expect(result.done).toBe(false);
    expect(result.why).toBe("Wechsel zu Variante B.");
    expect(result.showStimulusPosition).toBe(2);
    expect(result.message).toBe("Wie wirkt dieses Bild auf Sie?");
    expect(emitted).toBe("Wie wirkt dieses Bild auf Sie?");
    expect(emitted.toLowerCase()).not.toContain("show:");
  });

  it("survives char-by-char streaming without leaking the SHOW line", () => {
    const text =
      "DONE: false\nWHY: Einstieg.\nSHOW: 1\n\nSchauen Sie sich das Bild an.";
    const { result, emitted } = feed([...text]);
    expect(result.showStimulusPosition).toBe(1);
    expect(emitted).toBe("Schauen Sie sich das Bild an.");
  });

  it("exposes the show value mid-stream via showStimulusPosition()", () => {
    const parser = createDoneHeaderParser();
    parser.push("DONE: false\nWHY: x.\n");
    expect(parser.showStimulusPosition()).toBeNull();
    parser.push("SHOW: 3\n");
    expect(parser.showStimulusPosition()).toBe(3);
    parser.push("\nFrage?");
    expect(parser.finish().showStimulusPosition).toBe(3);
  });

  it("accepts SHOW directly after DONE when the model skipped WHY (leak guard)", () => {
    const { result, emitted } = feed(["DONE: false\nSHOW: 2\n\nFrage?"]);
    expect(result.showStimulusPosition).toBe(2);
    expect(result.why).toBeNull();
    expect(emitted).toBe("Frage?");
  });

  it("swallows a SHOW line with a garbage value instead of streaming it", () => {
    const { result, emitted } = feed([
      "DONE: false\nWHY: x.\nSHOW: zwei\n\nFrage?",
    ]);
    expect(result.showStimulusPosition).toBeNull();
    expect(emitted).toBe("Frage?");
    expect(emitted.toLowerCase()).not.toContain("show");
  });

  it("does NOT eat a body that merely starts with the word Show", () => {
    const { result, emitted } = feed([
      "DONE: false\nWHY: x.\n\nShow me how you would start.",
    ]);
    expect(result.showStimulusPosition).toBeNull();
    expect(emitted).toBe("Show me how you would start.");
  });

  it("takes a bare trailing SHOW header when the stream ends inside line 3", () => {
    const { result } = feed(["DONE: true\nWHY: Abschluss.\nSHOW: 3"]);
    expect(result.showStimulusPosition).toBe(3);
    expect(result.message).toBe("");
  });

  it("strips a trailing body SHOW and adopts its value (Eval-Befund)", () => {
    const { result } = feed([
      "DONE: false\nWHY: Wechsel.\n\nSchauen Sie sich das nächste Motiv an — was fällt auf?  SHOW: 2",
    ]);
    expect(result.showStimulusPosition).toBe(2);
    expect(result.message).toBe(
      "Schauen Sie sich das nächste Motiv an — was fällt auf?",
    );
  });

  it("header SHOW wins over a trailing body SHOW (which is still stripped)", () => {
    const { result } = feed([
      "DONE: false\nWHY: x.\nSHOW: 3\n\nFrage? SHOW: 1",
    ]);
    expect(result.showStimulusPosition).toBe(3);
    expect(result.message).toBe("Frage?");
  });

  it("keeps the no-SHOW path byte-identical (null, body streams)", () => {
    const { result, emitted } = feed([
      "DONE: false\nWHY: Vertiefung.\n\nWas genau blieb unklar?",
    ]);
    expect(result.showStimulusPosition).toBeNull();
    expect(result.why).toBe("Vertiefung.");
    expect(emitted).toBe("Was genau blieb unklar?");
  });
});

describe("formatStimulusSet + Kontext (E4)", () => {
  it("renders the numbered set with Regie, scaled ceiling and preference rule", () => {
    const block = formatStimulusSet(setInput(TWO_SET).plan);
    expect(block).toContain("STIMULUS-SET (2 Stimuli");
    expect(block).toContain("1. „Variante A“ (Bild) — Beschreibung: Blaues Packaging");
    expect(block).toContain("2. „Variante B“ (Bild)");
    expect(block).toContain("PFLICHT-PRÄFERENZFRAGE");
    // D8: N=2 → min(2 + 6 + 1, 14) = 9
    expect(block).toContain("ab 8 Agent-Fragen aktiv abwickeln, ab 9");
    expect(block).not.toContain("https://storage.example");
  });

  it("omits the preference rule for a single-stimulus set", () => {
    const block = formatStimulusSet(setInput([setItem({})]).plan);
    expect(block).not.toContain("PFLICHT-PRÄFERENZFRAGE");
  });

  it("trims per-item analyses once the set reaches 3 elements", () => {
    const longAnalysis = `${"Satz eins. ".repeat(200)}ENDE-MARKER`;
    const block = formatStimulusSet(
      setInput([
        setItem({ analysis: longAnalysis }),
        setItem({ position: 2, analysis: longAnalysis }),
        setItem({ position: 3, analysis: longAnalysis }),
      ]).plan,
    )!;
    expect(block).not.toContain("ENDE-MARKER");
    expect(block).toContain("ANALYSE");
  });

  it("scales the D8 ceiling and caps it", () => {
    expect(stimulusSetCeiling(1)).toBe(5);
    expect(stimulusSetCeiling(2)).toBe(9);
    expect(stimulusSetCeiling(3)).toBe(12);
    expect(stimulusSetCeiling(5)).toBe(14);
  });

  it("replaces the legacy block in the context and stays absent without a set", () => {
    const withSet = buildResearchContext(setInput(TWO_SET), "de");
    expect(withSet).toContain("STIMULUS-SET");
    expect(withSet).not.toContain("Dem Teilnehmer wird gerade gezeigt");

    const withoutKey = buildResearchContext(BASE_INPUT, "de");
    const withEmpty = buildResearchContext(setInput([]), "de");
    expect(withEmpty).toBe(withoutKey);
    expect(withoutKey).not.toContain("STIMULUS-SET");
  });
});

describe("buildResearchTail — Stimulus-COUNTERS (E4)", () => {
  const history: InterviewTurn[] = [
    { role: "agent", text: "Intro?", shownStimulusPosition: 1 },
    { role: "customer", text: "Ok." },
    { role: "agent", text: "Vergleich?", shownStimulusPosition: 2 },
    { role: "customer", text: "Besser." },
  ];

  it("computes revealed + currently shown from persisted markers", () => {
    const tail = buildResearchTail(setInput(TWO_SET), history);
    expect(tail).toContain("stimuli in the set:           2");
    expect(tail).toContain("stimuli revealed so far:      2 of 2");
    expect(tail).toContain("currently shown stimulus:     #2 („Variante B“)");
  });

  it("tells the agent explicitly when nothing is shown yet", () => {
    const tail = buildResearchTail(setInput(TWO_SET), []);
    expect(tail).toContain("currently shown stimulus:     NONE");
  });

  it("stays byte-identical without a set", () => {
    const tail = buildResearchTail(BASE_INPUT, history);
    expect(tail).not.toContain("stimuli");
  });
});

describe("formatRoundCeiling — configurable round ceiling (Paket 1)", () => {
  it("returns null at the default ceiling (no override → byte-identical)", () => {
    expect(formatRoundCeiling(DEFAULT_RESEARCH_AGENT_CEILING)).toBeNull();
    expect(formatRoundCeiling(6)).toBeNull();
  });

  it("emits a 5/6-replacing override for a non-default ceiling", () => {
    const short = formatRoundCeiling(4);
    expect(short).toContain("ERSETZT die Basis-Zahlen 5/6");
    expect(short).toContain("ab 3 Agent-Fragen aktiv abwickeln, ab 4");

    const deep = formatRoundCeiling(10);
    expect(deep).toContain("ab 9 Agent-Fragen aktiv abwickeln, ab 10");
  });

  it("injects the override into the context for non-stimulus studies", () => {
    const withCeiling = buildResearchContext(
      { ...BASE_INPUT, plan: { ...BASE_INPUT.plan, maxRounds: 10 } },
      "de",
    );
    expect(withCeiling).toContain("ab 9 Agent-Fragen aktiv abwickeln, ab 10");
  });

  it("stays byte-identical at the default ceiling and when unset", () => {
    const base = buildResearchContext(BASE_INPUT, "de");
    const atDefault = buildResearchContext(
      { ...BASE_INPUT, plan: { ...BASE_INPUT.plan, maxRounds: 6 } },
      "de",
    );
    const unset = buildResearchContext(
      { ...BASE_INPUT, plan: { ...BASE_INPUT.plan, maxRounds: null } },
      "de",
    );
    expect(atDefault).toBe(base);
    expect(unset).toBe(base);
    expect(base).not.toContain("ABWEICHENDES STOP-CEILING");
  });

  it("does NOT add the round override when a stimulus set is present (set ceiling wins)", () => {
    const withSetAndRounds = buildResearchContext(
      { ...setInput(TWO_SET), plan: { ...setInput(TWO_SET).plan, maxRounds: 10 } },
      "de",
    );
    // The set's own ceiling (N=2 → 9) renders; the maxRounds override (…ab 10)
    // must NOT, because buildResearchContext gates it on !hasStimulusSet.
    expect(withSetAndRounds).toContain("ab 8 Agent-Fragen aktiv abwickeln, ab 9");
    expect(withSetAndRounds).not.toContain("ab 10");
  });
});

describe("formatDepthDirective — per-topic laddering depth (Interviewtiefe)", () => {
  it("returns null at the default depth (mittel → byte-identical)", () => {
    expect(formatDepthDirective("mittel")).toBeNull();
  });

  it("emits a saturation-rule override for flach (1 layer)", () => {
    const flach = formatDepthDirective("flach");
    expect(flach).toContain("ERSETZT die Saturation-Basisregel");
    expect(flach).toContain("flach");
    expect(flach).toContain("KEINE vertiefende Nachfrage");
  });

  it("emits a 4-layer override for tief", () => {
    const tief = formatDepthDirective("tief");
    expect(tief).toContain("ERSETZT die Saturation-Basisregel");
    expect(tief).toContain("bis zu 4 Laddering-Schichten");
  });

  it("injects the directive into the context for non-stimulus studies", () => {
    const withDepth = buildResearchContext(
      { ...BASE_INPUT, plan: { ...BASE_INPUT.plan, depth: "tief" } },
      "de",
    );
    expect(withDepth).toContain("bis zu 4 Laddering-Schichten");
  });

  it("stays byte-identical at mittel and when unset", () => {
    const base = buildResearchContext(BASE_INPUT, "de");
    const atMittel = buildResearchContext(
      { ...BASE_INPUT, plan: { ...BASE_INPUT.plan, depth: "mittel" } },
      "de",
    );
    const unset = buildResearchContext(
      { ...BASE_INPUT, plan: { ...BASE_INPUT.plan, depth: null } },
      "de",
    );
    expect(atMittel).toBe(base);
    expect(unset).toBe(base);
    expect(base).not.toContain("INTERVIEW-TIEFE");
  });

  it("does NOT inject the depth directive when a stimulus set is present", () => {
    const withSetAndDepth = buildResearchContext(
      {
        ...setInput(TWO_SET),
        plan: { ...setInput(TWO_SET).plan, depth: "tief" },
      },
      "de",
    );
    expect(withSetAndDepth).not.toContain("INTERVIEW-TIEFE");
  });
});

describe("stripTurnInternals — Reveal-Marker (E4)", () => {
  it("keeps shownStimulusPosition for the participant but strips why", () => {
    const stripped = stripTurnInternals([
      { role: "agent", text: "F?", why: "geheim", shownStimulusPosition: 2 },
      { role: "customer", text: "A." },
    ]);
    expect(stripped).toEqual([
      { role: "agent", text: "F?", shownStimulusPosition: 2 },
      { role: "customer", text: "A." },
    ]);
  });
});

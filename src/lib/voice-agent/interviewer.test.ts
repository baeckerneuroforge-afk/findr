import { describe, expect, it } from "vitest";

import {
  buildResearchContext,
  buildResearchSystemPrompt,
  buildTurnMessages,
  createDoneHeaderParser,
  stripTurnInternals,
  type InterviewTurn,
  type ResearchInput,
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
    });
  });

  it("parses done: true case-insensitively and with a single newline", () => {
    const parser = createDoneHeaderParser();
    parser.push("done: TRUE\nDanke für das Gespräch!");
    expect(parser.finish()).toEqual({
      done: true,
      message: "Danke für das Gespräch!",
      why: null,
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
    expect(parser.finish()).toEqual({ done: true, message: "", why: null });
  });

  it("tolerates blank lines BEFORE the header (review finding)", () => {
    const parser = createDoneHeaderParser();
    parser.push("\n");
    parser.push("\nDONE: true\n\nDanke!");
    expect(parser.finish()).toEqual({ done: true, message: "Danke!", why: null });
  });

  it("emits nothing for the header even when everything arrives in one chunk", () => {
    const parser = createDoneHeaderParser();
    const emitted = parser.push("DONE: true\n\nAuf Wiedersehen!");
    expect(emitted).toBe("Auf Wiedersehen!");
    expect(parser.finish()).toEqual({ done: true, message: "Auf Wiedersehen!", why: null });
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
    });
  });

  it("treats a bare DONE + WHY with no body as empty message (caller retries)", () => {
    const parser = createDoneHeaderParser();
    parser.push("DONE: true\nWHY: Teilnehmer bat um Abschluss");
    expect(parser.finish()).toEqual({
      done: true,
      message: "",
      why: "Teilnehmer bat um Abschluss",
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

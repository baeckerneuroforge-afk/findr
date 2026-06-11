import { describe, expect, it } from "vitest";

import {
  buildTurnSignalsUserPrompt,
  sealTurnSignals,
} from "@/lib/research/turn-signals";
import {
  TURN_SIGNALS_VERSION,
  TurnSignalsExtractionSchema,
  type TurnSignalsExtraction,
} from "@/lib/schemas/turn-signals";
import type { InterviewTurn } from "@/lib/voice-agent/interviewer";

/**
 * E1 Turn-Signale — Unit-Tests der PUREN Härtungs-/Prompt-Schicht. Der
 * LLM-Transport (callClaudeStructured) wird hier nicht angefasst — Modell-
 * Qualität misst evals-turn-signals/run.ts. Hier steht, was deterministisch
 * garantiert sein MUSS, bevor irgendetwas persistiert wird:
 *   - „ohne Zitat kein Label" (Anti-Halluzinations-Regel, Plan §4.2)
 *   - Index-Disziplin (Signale nur auf echten customer-Turns)
 *   - geschlossene Taxonomie (Schema weist fremde Zustände ab)
 *   - deterministische Counts (nie vom Modell übernommen)
 */

const conversation: InterviewTurn[] = [
  { role: "agent", text: "Wie läuft das Onboarding bei euch?" },
  {
    role: "customer",
    text: "Ehrlich gesagt richtig gut — das Team war begeistert!",
  },
  { role: "agent", text: "Und wie sieht es beim Preis aus?" },
  { role: "customer", text: "Hm, schwer zu sagen, eigentlich…" },
];

function extraction(
  turns: TurnSignalsExtraction["turns"],
  affectArc = "Begann offen, zögerte bei Preisfragen.",
): TurnSignalsExtraction {
  return { turns, session: { affectArc } };
}

const baseTurn = {
  affectIntensity: "medium",
  unansweredAspect: null,
  confidence: 0.8,
} as const;

describe("sealTurnSignals — Zitat-Treue (ohne Zitat kein Label)", () => {
  it("keeps a non-neutral affect whose evidence is a verbatim substring", () => {
    const sealed = sealTurnSignals(
      extraction([
        {
          ...baseTurn,
          index: 1,
          affect: "enthusiasm",
          affectEvidence: "das Team war begeistert",
          directness: "direct",
        },
      ]),
      conversation,
      "test-model",
    );
    expect(sealed.turns).toHaveLength(1);
    expect(sealed.turns[0].affect).toBe("enthusiasm");
    expect(sealed.turns[0].affectEvidence).toBe("das Team war begeistert");
  });

  it("matches evidence across typographic quotes, case and whitespace", () => {
    const sealed = sealTurnSignals(
      extraction([
        {
          ...baseTurn,
          index: 3,
          affect: "uncertainty",
          // Modell zitiert mit typografischen Anführungszeichen + anderem Case.
          affectEvidence: "„Hm,  schwer zu sagen“",
          directness: "partial",
          unansweredAspect: "konkreter Preisrahmen",
        },
      ]),
      conversation,
      "test-model",
    );
    expect(sealed.turns[0].affect).toBe("uncertainty");
    expect(sealed.turns[0].unansweredAspect).toBe("konkreter Preisrahmen");
  });

  it("degrades a fabricated quote to neutral/low without evidence", () => {
    const sealed = sealTurnSignals(
      extraction([
        {
          ...baseTurn,
          index: 1,
          affect: "frustration",
          affectEvidence: "das nervt mich total", // kommt im Turn nicht vor
          directness: "direct",
        },
      ]),
      conversation,
      "test-model",
    );
    expect(sealed.turns[0].affect).toBe("neutral");
    expect(sealed.turns[0].affectIntensity).toBe("low");
    expect(sealed.turns[0].affectEvidence).toBeNull();
    // Direktheit braucht kein Zitat — sie überlebt die Degradierung.
    expect(sealed.turns[0].directness).toBe("direct");
  });

  it("degrades a non-neutral affect that arrives without any quote", () => {
    const sealed = sealTurnSignals(
      extraction([
        {
          ...baseTurn,
          index: 1,
          affect: "interest",
          affectEvidence: null,
          directness: "direct",
        },
      ]),
      conversation,
      "test-model",
    );
    expect(sealed.turns[0].affect).toBe("neutral");
  });

  it("drops a quote delivered alongside a neutral label", () => {
    const sealed = sealTurnSignals(
      extraction([
        {
          ...baseTurn,
          index: 1,
          affect: "neutral",
          affectEvidence: "richtig gut",
          directness: "direct",
        },
      ]),
      conversation,
      "test-model",
    );
    expect(sealed.turns[0].affectEvidence).toBeNull();
  });
});

describe("sealTurnSignals — Index-Disziplin", () => {
  it("discards signals pointing at interviewer turns or out of range", () => {
    const sealed = sealTurnSignals(
      extraction([
        {
          ...baseTurn,
          index: 0, // agent-Turn
          affect: "neutral",
          affectEvidence: null,
          directness: "direct",
        },
        {
          ...baseTurn,
          index: 99, // out of range
          affect: "neutral",
          affectEvidence: null,
          directness: "direct",
        },
        {
          ...baseTurn,
          index: 1,
          affect: "neutral",
          affectEvidence: null,
          directness: "direct",
        },
      ]),
      conversation,
      "test-model",
    );
    expect(sealed.turns.map((t) => t.index)).toEqual([1]);
  });

  it("keeps the first entry on duplicate indices", () => {
    const sealed = sealTurnSignals(
      extraction([
        {
          ...baseTurn,
          index: 1,
          affect: "enthusiasm",
          affectEvidence: "richtig gut",
          directness: "direct",
        },
        {
          ...baseTurn,
          index: 1,
          affect: "frustration",
          affectEvidence: "richtig gut",
          directness: "evasive",
        },
      ]),
      conversation,
      "test-model",
    );
    expect(sealed.turns).toHaveLength(1);
    expect(sealed.turns[0].affect).toBe("enthusiasm");
  });
});

describe("sealTurnSignals — Konsistenz & Counts", () => {
  it("nulls unansweredAspect on direct answers and derives counts deterministically", () => {
    const sealed = sealTurnSignals(
      extraction([
        {
          ...baseTurn,
          index: 1,
          affect: "neutral",
          affectEvidence: null,
          directness: "direct",
          unansweredAspect: "sollte hier nicht stehen",
        },
        {
          ...baseTurn,
          index: 3,
          affect: "neutral",
          affectEvidence: null,
          directness: "evasive",
          unansweredAspect: "konkreter Preisrahmen",
        },
      ]),
      conversation,
      "test-model",
    );
    expect(sealed.turns[0].unansweredAspect).toBeNull();
    expect(sealed.turns[1].unansweredAspect).toBe("konkreter Preisrahmen");
    expect(sealed.session.directCount).toBe(1);
    expect(sealed.session.evasiveCount).toBe(1);
    expect(sealed.version).toBe(TURN_SIGNALS_VERSION);
    expect(sealed.model).toBe("test-model");
  });

  it("caps an overlong affectArc", () => {
    const sealed = sealTurnSignals(
      extraction([], "x".repeat(2000)),
      conversation,
      "test-model",
    );
    expect(sealed.session.affectArc.length).toBeLessThanOrEqual(600);
  });
});

describe("TurnSignalsExtractionSchema — geschlossene Taxonomie", () => {
  it("rejects affect states outside the closed vocabulary (no health labels)", () => {
    const parsed = TurnSignalsExtractionSchema.safeParse({
      turns: [
        {
          index: 1,
          affect: "stressed", // bewusst KEIN gültiger Zustand
          affectIntensity: "low",
          affectEvidence: null,
          directness: "direct",
          unansweredAspect: null,
          confidence: 0.5,
        },
      ],
      session: { affectArc: "…" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects out-of-range confidence", () => {
    const parsed = TurnSignalsExtractionSchema.safeParse({
      turns: [
        {
          index: 1,
          affect: "neutral",
          affectIntensity: "low",
          affectEvidence: null,
          directness: "direct",
          unansweredAspect: null,
          confidence: 1.5,
        },
      ],
      session: { affectArc: "…" },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("buildTurnSignalsUserPrompt — KI-VO-Grenze (nur Wortlaut)", () => {
  it("contains exactly the numbered wording — no timestamps, no metrics", () => {
    const prompt = buildTurnSignalsUserPrompt({
      conversation,
      language: "de",
      planTitle: "Onboarding-Studie",
    });
    expect(prompt).toContain('research study "Onboarding-Studie"');
    expect(prompt).toContain("[0] INTERVIEWER: Wie läuft das Onboarding");
    expect(prompt).toContain("[1] PARTICIPANT: Ehrlich gesagt richtig gut");
    expect(prompt).toContain("TRANSCRIPT LANGUAGE: German");
    // Negativ-Garantie: nichts außer Kontextzeile + Sprache + Wortlaut.
    expect(prompt).not.toMatch(/latency|timestamp|duration|ms|audio/i);
  });
});

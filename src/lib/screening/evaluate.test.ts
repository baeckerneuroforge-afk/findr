import { describe, expect, it } from "vitest";
import {
  ScreeningAnswersSchema,
  ScreeningQuestionsSchema,
  type ScreeningQuestions,
} from "../schemas/screening";
import { evaluateScreening } from "./evaluate";

// ── Fixtures (gültige Fragen je Typ) ─────────────────────────────────────────
const roleQuestion = {
  id: "role",
  type: "single_choice" as const,
  prompt: "Deine Rolle?",
  required: true,
  options: ["Founder", "Head of Sales", "SDR", "Andere"],
  accepted: ["Founder", "Head of Sales"],
};

const toolsQuestion = {
  id: "tools",
  type: "multi_choice" as const,
  prompt: "Womit arbeitet ihr?",
  required: true,
  options: ["CRM", "Outreach", "Warehouse"],
  acceptedAny: ["CRM", "Outreach"],
};

const sizeQuestion = {
  id: "size",
  type: "number_range" as const,
  prompt: "Mitarbeiterzahl?",
  required: true,
  min: 50,
  max: 5000,
};

describe("evaluateScreening — single_choice", () => {
  it("qualifiziert bei akzeptierter Antwort", () => {
    const r = evaluateScreening([roleQuestion], { role: "Founder" });
    expect(r.qualified).toBe(true);
    expect(r.perQuestion).toEqual({ role: true });
  });

  it("weist ab bei nicht-akzeptierter Antwort", () => {
    const r = evaluateScreening([roleQuestion], { role: "SDR" });
    expect(r.qualified).toBe(false);
    expect(r.perQuestion.role).toBe(false);
  });
});

describe("evaluateScreening — multi_choice", () => {
  it("qualifiziert, wenn mind. eine Auswahl in acceptedAny liegt", () => {
    const r = evaluateScreening([toolsQuestion], { tools: ["CRM", "Warehouse"] });
    expect(r.qualified).toBe(true);
  });

  it("weist ab, wenn keine Auswahl in acceptedAny liegt", () => {
    const r = evaluateScreening([toolsQuestion], { tools: ["Warehouse"] });
    expect(r.qualified).toBe(false);
  });

  it("weist ab bei leerer Auswahl (Pflichtfrage)", () => {
    const r = evaluateScreening([toolsQuestion], { tools: [] });
    expect(r.qualified).toBe(false);
  });
});

describe("evaluateScreening — number_range", () => {
  it("qualifiziert innerhalb des Intervalls", () => {
    expect(evaluateScreening([sizeQuestion], { size: 500 }).qualified).toBe(true);
  });

  it("weist ab unterhalb / oberhalb", () => {
    expect(evaluateScreening([sizeQuestion], { size: 10 }).qualified).toBe(false);
    expect(evaluateScreening([sizeQuestion], { size: 6000 }).qualified).toBe(false);
  });

  it("Grenzwerte sind inklusiv (== min, == max)", () => {
    expect(evaluateScreening([sizeQuestion], { size: 50 }).qualified).toBe(true);
    expect(evaluateScreening([sizeQuestion], { size: 5000 }).qualified).toBe(true);
  });

  it("knapp außerhalb (min-1, max+1) weist ab", () => {
    expect(evaluateScreening([sizeQuestion], { size: 49 }).qualified).toBe(false);
    expect(evaluateScreening([sizeQuestion], { size: 5001 }).qualified).toBe(false);
  });
});

describe("evaluateScreening — required / optional / fehlend", () => {
  it("fehlende Pflichtantwort = nicht qualifiziert (fail-closed)", () => {
    const r = evaluateScreening([roleQuestion], {});
    expect(r.qualified).toBe(false);
    expect(r.perQuestion.role).toBe(false);
  });

  it("fehlende optionale Antwort blockt nicht", () => {
    const optionalRole = { ...roleQuestion, required: false };
    const r = evaluateScreening([optionalRole], {});
    expect(r.qualified).toBe(true);
    expect(r.perQuestion.role).toBe(true);
  });

  it("optionale Frage mit nicht-passender Antwort blockt trotzdem nicht", () => {
    const optionalRole = { ...roleQuestion, required: false };
    const r = evaluateScreening([optionalRole], { role: "SDR" });
    expect(r.qualified).toBe(true);
    // perQuestion berichtet den echten Treffer, qualified ignoriert optionale.
    expect(r.perQuestion.role).toBe(false);
  });

  it("Pflicht passt + optional scheitert => qualifiziert", () => {
    const optionalSize = { ...sizeQuestion, required: false };
    const r = evaluateScreening([roleQuestion, optionalSize], {
      role: "Founder",
      size: 10,
    });
    expect(r.qualified).toBe(true);
    expect(r.perQuestion).toEqual({ role: true, size: false });
  });
});

describe("evaluateScreening — striktes UND über required", () => {
  it("alle Pflichtfragen passen => qualifiziert", () => {
    const r = evaluateScreening([roleQuestion, toolsQuestion, sizeQuestion], {
      role: "Head of Sales",
      tools: ["Outreach"],
      size: 200,
    });
    expect(r.qualified).toBe(true);
    expect(r.perQuestion).toEqual({ role: true, tools: true, size: true });
  });

  it("genau eine Pflichtfrage scheitert => nicht qualifiziert", () => {
    const r = evaluateScreening([roleQuestion, toolsQuestion, sizeQuestion], {
      role: "Founder",
      tools: ["Warehouse"], // scheitert
      size: 200,
    });
    expect(r.qualified).toBe(false);
    expect(r.perQuestion).toEqual({ role: true, tools: false, size: true });
  });
});

describe("evaluateScreening — leere Config = No-op", () => {
  it("keine Fragen, keine Antworten => qualifiziert", () => {
    const r = evaluateScreening([], {});
    expect(r.qualified).toBe(true);
    expect(r.perQuestion).toEqual({});
  });

  it("keine Fragen, aber Antworten vorhanden => qualifiziert", () => {
    const r = evaluateScreening([], { irgendwas: "x" });
    expect(r.qualified).toBe(true);
  });
});

describe("evaluateScreening — fail-closed bei Typ-Mismatch der Antwort", () => {
  it("single_choice mit Zahl-Antwort => nicht qualifiziert", () => {
    const r = evaluateScreening([roleQuestion], { role: 123 });
    expect(r.qualified).toBe(false);
  });

  it("number_range mit String-Antwort => nicht qualifiziert", () => {
    const r = evaluateScreening([sizeQuestion], { size: "500" });
    expect(r.qualified).toBe(false);
  });

  it("multi_choice mit String-Antwort (kein Array) => nicht qualifiziert", () => {
    const r = evaluateScreening([toolsQuestion], { tools: "CRM" });
    expect(r.qualified).toBe(false);
  });
});

describe("ScreeningQuestionsSchema", () => {
  it("parst ein gültiges gemischtes Array", () => {
    const result = ScreeningQuestionsSchema.safeParse([
      roleQuestion,
      toolsQuestion,
      sizeQuestion,
    ]);
    expect(result.success).toBe(true);
  });

  it("required defaultet auf true, wenn weggelassen", () => {
    const result = ScreeningQuestionsSchema.parse([
      {
        id: "role",
        type: "single_choice",
        prompt: "Rolle?",
        options: ["A", "B"],
        accepted: ["A"],
      },
    ]) as ScreeningQuestions;
    expect(result[0].required).toBe(true);
  });

  it("lehnt unbekannten Frage-Typ ab", () => {
    const result = ScreeningQuestionsSchema.safeParse([
      { id: "x", type: "free_text", prompt: "?", required: true },
    ]);
    expect(result.success).toBe(false);
  });

  it("lehnt doppelte ids ab", () => {
    const result = ScreeningQuestionsSchema.safeParse([
      roleQuestion,
      { ...sizeQuestion, id: "role" },
    ]);
    expect(result.success).toBe(false);
  });

  it("lehnt number_range mit min > max ab", () => {
    const result = ScreeningQuestionsSchema.safeParse([
      { ...sizeQuestion, min: 5000, max: 50 },
    ]);
    expect(result.success).toBe(false);
  });

  it("lehnt single_choice ohne accepted ab", () => {
    const result = ScreeningQuestionsSchema.safeParse([
      { id: "r", type: "single_choice", prompt: "?", options: ["A"], accepted: [] },
    ]);
    expect(result.success).toBe(false);
  });
});

describe("ScreeningAnswersSchema", () => {
  it("akzeptiert string / string[] / number als Werte", () => {
    const result = ScreeningAnswersSchema.safeParse({
      a: "x",
      b: ["x", "y"],
      c: 42,
    });
    expect(result.success).toBe(true);
  });

  it("lehnt einen boolean-Wert ab", () => {
    const result = ScreeningAnswersSchema.safeParse({ a: true });
    expect(result.success).toBe(false);
  });
});

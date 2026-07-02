import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  getResearchPlan,
  listPlanStimuli,
} from "@/lib/research/plans-service";
import { generateInterviewGuide } from "@/lib/research/guide-generator";
import { POST } from "./route";

/**
 * Regression — lange Persona kippt die KI-Leitfaden-Generierung NICHT mehr.
 *
 * Bug: der `who`-Cap dieser Route war 200, lag damit UNTER dem persona-Cap der
 * Plan-Route (1000) und Konsouls Vorschlags-Cap (240). Eine übernommene/lange
 * Persona legte den Entwurf an (201 Created), brach aber hier mit 400. Fix:
 * who-Cap = 1000 (eine Zahl end-to-end). Diese Tests nageln die Grenze fest, mit
 * dem exakt gemeldeten Fall (240 Zeichen) als Kern. Stil = Geschwister-Route-Test
 * (../route.test.ts): Deps gemockt, echter Handler aufgerufen.
 */

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock("@/lib/auth/org", () => ({
  requireOrgIdOrError: vi.fn(),
}));

vi.mock("@/lib/research/plans-service", () => ({
  getResearchPlan: vi.fn(),
  listPlanStimuli: vi.fn(),
}));

// Partial mock: nur der Anthropic-Call wird gemockt; buildStimulusContext
// bleibt ECHT, damit die E2-Tests das reale Block-Format/Gating prüfen.
vi.mock(import("@/lib/research/guide-generator"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, generateInterviewGuide: vi.fn() };
});

const mockRequireOrg = vi.mocked(requireOrgIdOrError);
const mockGetPlan = vi.mocked(getResearchPlan);
const mockListStimuli = vi.mocked(listPlanStimuli);
const mockGenerate = vi.mocked(generateInterviewGuide);

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const PLAN_ID = "00000000-0000-4000-8000-000000000002";

const GUIDE = {
  title: "Titel",
  objective: "Ziel",
  estimatedMinutes: 20,
  topics: [],
};

function context() {
  return { params: Promise.resolve({ id: PLAN_ID }) };
}

function postRequest(body: unknown) {
  return new Request(
    `http://localhost/api/research/plans/${PLAN_ID}/guide`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  ) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireOrg.mockResolvedValue({ orgId: ORG_ID } as never);
  mockGetPlan.mockResolvedValue({ id: PLAN_ID } as never);
  mockListStimuli.mockResolvedValue([]);
  mockGenerate.mockResolvedValue(GUIDE as never);
});

describe("POST /api/research/plans/[id]/guide — who-Länge", () => {
  it("akzeptiert eine 240-Zeichen-Persona (der gemeldete Bug-Fall) → 200", async () => {
    const who = "x".repeat(240);
    const res = await POST(postRequest({ goal: "Ein valides Ziel", who }), context());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // who fließt durch zum Generator (kein 400 mehr).
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate.mock.calls[0][0].who).toHaveLength(240);
  });

  it("akzeptiert who an der neuen Grenze (1000 Zeichen) → 200", async () => {
    const res = await POST(
      postRequest({ goal: "Ein valides Ziel", who: "y".repeat(1000) }),
      context(),
    );
    expect(res.status).toBe(200);
  });

  it("lehnt who über der Grenze (1001 Zeichen) ab → 400, Generator nicht gerufen", async () => {
    const res = await POST(
      postRequest({ goal: "Ein valides Ziel", who: "z".repeat(1001) }),
      context(),
    );
    expect(res.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("ohne who funktioniert weiterhin → 200", async () => {
    const res = await POST(postRequest({ goal: "Ein valides Ziel" }), context());
    expect(res.status).toBe(200);
  });
});

describe("POST …/guide — businessContext (E1)", () => {
  it("reicht businessContext an den Generator durch", async () => {
    const res = await POST(
      postRequest({
        goal: "Ein valides Ziel",
        businessContext: "Wir sind Klymeo, Bio-Naturkosmetik-Shop.",
      }),
      context(),
    );
    expect(res.status).toBe(200);
    expect(mockGenerate.mock.calls[0][0].businessContext).toBe(
      "Wir sind Klymeo, Bio-Naturkosmetik-Shop.",
    );
  });

  it("fällt ohne Body-Feld auf den persistierten plan.businessContext zurück", async () => {
    // Regenerierung über einen kontext-losen Pfad (klassische Form, Bridge)
    // darf den am Plan gespeicherten Kontext nicht still verlieren.
    mockGetPlan.mockResolvedValue({
      id: PLAN_ID,
      businessContext: "Persistierter Org-Kontext",
    } as never);
    const res = await POST(postRequest({ goal: "Ein valides Ziel" }), context());
    expect(res.status).toBe(200);
    expect(mockGenerate.mock.calls[0][0].businessContext).toBe(
      "Persistierter Org-Kontext",
    );
  });

  it('leerer String ("") heißt explizit geleert — KEIN Fallback auf den Plan', async () => {
    mockGetPlan.mockResolvedValue({
      id: PLAN_ID,
      businessContext: "Veralteter Draft-Kontext",
    } as never);
    const res = await POST(
      postRequest({ goal: "Ein valides Ziel", businessContext: "" }),
      context(),
    );
    expect(res.status).toBe(200);
    expect(mockGenerate.mock.calls[0][0].businessContext).toBeUndefined();
  });

  it("akzeptiert die Grenze (2000) und lehnt 2001 ab (Cap = eine Zahl end-to-end)", async () => {
    const ok = await POST(
      postRequest({ goal: "Ein valides Ziel", businessContext: "k".repeat(2000) }),
      context(),
    );
    expect(ok.status).toBe(200);

    const tooLong = await POST(
      postRequest({ goal: "Ein valides Ziel", businessContext: "k".repeat(2001) }),
      context(),
    );
    expect(tooLong.status).toBe(400);
  });

  it("ohne businessContext bleibt der Generator-Input undefined (byte-identisches Vor-Verhalten)", async () => {
    const res = await POST(postRequest({ goal: "Ein valides Ziel" }), context());
    expect(res.status).toBe(200);
    expect(mockGenerate.mock.calls[0][0].businessContext).toBeUndefined();
  });
});

describe("POST …/guide — stimulusContext (E2)", () => {
  const ANALYSED = [
    {
      analysisStatus: "done",
      label: "Plakat A",
      analysis: { textBlock: "Layout: zentriertes Produktbild" },
    },
    // pending → wird übersprungen
    { analysisStatus: "pending", label: "Plakat B", analysis: null },
    // done ohne textBlock → wird übersprungen
    { analysisStatus: "done", label: "Plakat C", analysis: {} },
  ];

  it("baut den MATERIAL-Kontext bei Konzepttest NUR aus analysierten Assets (status done)", async () => {
    mockListStimuli.mockResolvedValue(ANALYSED as never);
    const res = await POST(
      postRequest({ goal: "Ein valides Ziel", useCase: "concept_test" }),
      context(),
    );
    expect(res.status).toBe(200);
    const ctx = mockGenerate.mock.calls[0][0].stimulusContext;
    expect(ctx).toContain("Material 1 (Plakat A)");
    expect(ctx).toContain("Layout: zentriertes Produktbild");
    expect(ctx).not.toContain("Plakat B");
    expect(ctx).not.toContain("Plakat C");
  });

  it("Nicht-Material-Studienarten laden KEINE Stimuli (Alt-Assets kapern den Leitfaden nicht)", async () => {
    mockListStimuli.mockResolvedValue(ANALYSED as never);
    const res = await POST(
      postRequest({ goal: "Ein valides Ziel", useCase: "general_survey" }),
      context(),
    );
    expect(res.status).toBe(200);
    expect(mockListStimuli).not.toHaveBeenCalled();
    expect(mockGenerate.mock.calls[0][0].stimulusContext).toBeUndefined();
  });

  it("ohne Body-useCase entscheidet plan.useCase über das Stimulus-Gating", async () => {
    mockGetPlan.mockResolvedValue({
      id: PLAN_ID,
      useCase: "creative_test",
    } as never);
    mockListStimuli.mockResolvedValue(ANALYSED as never);
    const res = await POST(postRequest({ goal: "Ein valides Ziel" }), context());
    expect(res.status).toBe(200);
    expect(mockListStimuli).toHaveBeenCalledTimes(1);
    expect(mockGenerate.mock.calls[0][0].stimulusContext).toContain("Plakat A");
  });

  it("ohne analysierte Assets bleibt stimulusContext undefined", async () => {
    const res = await POST(
      postRequest({ goal: "Ein valides Ziel", useCase: "concept_test" }),
      context(),
    );
    expect(res.status).toBe(200);
    expect(mockGenerate.mock.calls[0][0].stimulusContext).toBeUndefined();
  });
});

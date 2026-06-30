import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
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
}));

vi.mock("@/lib/research/guide-generator", () => ({
  generateInterviewGuide: vi.fn(),
  GuideGeneratorUnavailableError: class GuideGeneratorUnavailableError extends Error {},
}));

const mockRequireOrg = vi.mocked(requireOrgIdOrError);
const mockGetPlan = vi.mocked(getResearchPlan);
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

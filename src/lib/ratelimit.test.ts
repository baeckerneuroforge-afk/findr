import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextAuthRequest } from "next-auth";

import {
  checkRateLimit,
  classifyApiPath,
  deriveRateLimitKey,
  enforceRateLimit,
  RATE_LIMITS,
} from "@/lib/ratelimit";

/**
 * Rate-Limiter — die nicht-verhandelbare Semantik unter Test:
 *   • INERT OHNE ENV → kein fetch, alles durch.
 *   • FAIL-OPEN bei Store-Fehler (Default) + lautes console.error.
 *   • DEFINITIVES Über-Limit → 429.
 *   • Klassifizierung (exempt vor allem; voiceAgent/participant/llm/mutation).
 *   • Key-Ableitung nicht spoofbar (Session-JWT/Pfad-Token/IP; KEIN Header).
 *   • enforceRateLimit überspringt Upstash bei exempt; 429-Form korrekt.
 *
 * fetch wird durchgängig gemockt; UPSTASH-Env pro Test gesetzt/gelöscht.
 */

const URL_ENV = "UPSTASH_REDIS_REST_URL";
const TOKEN_ENV = "UPSTASH_REDIS_REST_TOKEN";

/** Upstash-Pipeline-Erfolgsantwort: [SET-Resultat, INCR-Zähler]. Der count steht
 *  im ZWEITEN Element (SET…EX…NX zuerst, dann INCR). */
function upstashOk(count: number): Response {
  return new Response(
    JSON.stringify([{ result: "OK" }, { result: count }]),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/** Minimal-strukturell ausreichender NextAuthRequest für die Key-Ableitung. */
function makeReq(opts: {
  pathname?: string;
  auth?: { user?: { id?: string; orgId?: string } } | null;
  headers?: Record<string, string>;
}): NextAuthRequest {
  return {
    auth: opts.auth ?? null,
    nextUrl: { pathname: opts.pathname ?? "/api/research/plans" },
    headers: new Headers(opts.headers ?? {}),
  } as unknown as NextAuthRequest;
}

let fetchSpy: ReturnType<typeof vi.fn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  errorSpy.mockRestore();
  vi.restoreAllMocks();
});

describe("checkRateLimit — inert ohne Env", () => {
  it("lässt durch und ruft fetch NICHT auf, wenn beide UPSTASH-Vars fehlen", async () => {
    vi.stubEnv(URL_ENV, "");
    vi.stubEnv(TOKEN_ENV, "");

    const r = await checkRateLimit("mutation", "k");

    expect(r).toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ist auch inert, wenn nur EINE Var gesetzt ist", async () => {
    vi.stubEnv(URL_ENV, "https://example.upstash.io");
    vi.stubEnv(TOKEN_ENV, "   "); // whitespace zählt als ungesetzt

    const r = await checkRateLimit("mutation", "k");

    expect(r).toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("checkRateLimit — fail-open bei Store-Fehler (Default)", () => {
  beforeEach(() => {
    vi.stubEnv(URL_ENV, "https://example.upstash.io");
    vi.stubEnv(TOKEN_ENV, "tok");
  });

  it("fetch rejectet (Timeout/AbortError) → { ok: true } + console.error", async () => {
    fetchSpy.mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    );

    const r = await checkRateLimit("mutation", "k");

    expect(r).toEqual({ ok: true });
    expect(errorSpy).toHaveBeenCalledWith(
      "[ratelimit] store error, failing open",
      expect.objectContaining({ cls: "mutation" }),
    );
  });

  it("non-2xx (HTTP 500) → { ok: true } + console.error", async () => {
    fetchSpy.mockResolvedValue(new Response("boom", { status: 500 }));

    const r = await checkRateLimit("mutation", "k");

    expect(r).toEqual({ ok: true });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("Error-Shape im Body ({error:…}) → { ok: true } + console.error", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: "ERR bad command" }), {
        status: 200,
      }),
    );

    const r = await checkRateLimit("mutation", "k");

    expect(r).toEqual({ ok: true });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("unerwartetes Shape (count keine Zahl) → { ok: true }", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify([{ result: "OK" }, { result: "nope" }]), {
        status: 200,
      }),
    );

    const r = await checkRateLimit("mutation", "k");

    expect(r).toEqual({ ok: true });
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("checkRateLimit — definitives Urteil", () => {
  beforeEach(() => {
    vi.stubEnv(URL_ENV, "https://example.upstash.io");
    vi.stubEnv(TOKEN_ENV, "tok");
  });

  it("über Limit → 429-Ergebnis { ok:false, remaining:0, retryAfter:60 }", async () => {
    const { limit } = RATE_LIMITS.mutation;
    fetchSpy.mockResolvedValue(upstashOk(limit + 1));

    const r = await checkRateLimit("mutation", "k");

    expect(r).toEqual({ ok: false, remaining: 0, retryAfter: 60 });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("genau auf Limit (count === limit) → noch durch (remaining 0)", async () => {
    const { limit } = RATE_LIMITS.mutation;
    fetchSpy.mockResolvedValue(upstashOk(limit));

    const r = await checkRateLimit("mutation", "k");

    expect(r).toEqual({ ok: true, remaining: 0 });
  });

  it("unter Limit → { ok:true, remaining: limit-1 }", async () => {
    const { limit } = RATE_LIMITS.mutation;
    fetchSpy.mockResolvedValue(upstashOk(1));

    const r = await checkRateLimit("mutation", "k");

    expect(r).toEqual({ ok: true, remaining: limit - 1 });
  });

  it("ruft Upstash /pipeline mit Bearer + SET…EX…NX/INCR-Body und Präfix-Key", async () => {
    fetchSpy.mockResolvedValue(upstashOk(1));

    await checkRateLimit("llm", "user:abc");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.upstash.io/pipeline");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok",
    );
    const body = JSON.parse(init.body as string);
    // SET …EX…NX zuerst (TTL atomar beim Anlegen), dann INCR — so trägt der
    // Schlüssel IMMER eine TTL (kein TTL-loses Akkumulieren möglich).
    expect(body).toEqual([
      ["SET", "rl:llm:user:abc", "0", "EX", "60", "NX"],
      ["INCR", "rl:llm:user:abc"],
    ]);
  });
});

describe("checkRateLimit — auth fail-closed-Schalter", () => {
  beforeEach(() => {
    vi.stubEnv(URL_ENV, "https://example.upstash.io");
    vi.stubEnv(TOKEN_ENV, "tok");
    fetchSpy.mockRejectedValue(new Error("store down"));
  });

  it("DEFAULT (Schalter aus): auth-Fehler fällt OPEN wie alle anderen", async () => {
    // Kein RATE_LIMIT_AUTH_FAIL_CLOSED gesetzt → Default-Konstante false.
    const r = await checkRateLimit("auth", "k");
    expect(r).toEqual({ ok: true });
  });

  it("Schalter an: auth-Fehler fällt CLOSED → { ok:false }, mutation bleibt OPEN", async () => {
    vi.stubEnv("RATE_LIMIT_AUTH_FAIL_CLOSED", "true");

    const authRes = await checkRateLimit("auth", "k");
    expect(authRes).toEqual({ ok: false, retryAfter: 60 });

    // identischer Fehler, andere Klasse → weiterhin fail-open.
    const mutRes = await checkRateLimit("mutation", "k");
    expect(mutRes).toEqual({ ok: true });
  });
});

describe("classifyApiPath", () => {
  it.each([
    ["/api/health", "exempt"],
    ["/api/csp-report", "exempt"],
    ["/api/cron/retention", "exempt"],
    ["/api/auth/callback/zitadel", "exempt"],
    ["/api/webhooks/hubspot/deal-update", "exempt"],
    ["/api/integrations/gong/callback", "exempt"],
    ["/api/voice/transcript", "voiceAgent"],
    ["/api/voice/complete", "voiceAgent"],
    ["/api/voice/token", "participant"],
    ["/api/interview/abc/stream", "participant"],
    ["/api/interview/open/xyz/speak", "participant"],
    ["/api/research/plans/p1/synthesis", "llm"],
    ["/api/research/plans/p1/personas", "llm"],
    ["/api/konsoul-agent", "llm"],
    ["/api/cross-study-agent", "llm"],
    ["/api/research/plans/p1/synthetic-test/run42/step", "llm"],
    ["/api/solution/generate", "llm"],
    ["/api/deals/d1/interview", "llm"],
    ["/api/bridge/research-to-sales/scan", "llm"],
    ["/api/research/plans", "mutation"],
    ["/api/deals/d1", "mutation"],
    ["/api/settings/org", "mutation"],
  ])("%s → %s", (path, expected) => {
    expect(classifyApiPath(path)).toBe(expected);
  });

  it("exempt gewinnt vor jeder anderen Stufe (Reihenfolge)", () => {
    // /api/auth/ ist exempt, selbst wenn der Pfad auf ein llm-Suffix endete.
    expect(classifyApiPath("/api/auth/signin/chat")).toBe("exempt");
  });
});

describe("deriveRateLimitKey — nicht spoofbar", () => {
  it("(a) Session mit orgId → org:<orgId>", () => {
    const req = makeReq({
      auth: { user: { id: "u1", orgId: "org_42" } },
    });
    expect(deriveRateLimitKey(req, "/api/research/plans", "mutation")).toBe(
      "org:org_42",
    );
  });

  it("(b) Session mit nur user.id (orgId undefined) → user:<id>", () => {
    const req = makeReq({ auth: { user: { id: "u1" } } });
    expect(deriveRateLimitKey(req, "/api/research/plans", "mutation")).toBe(
      "user:u1",
    );
  });

  it("(c) participant-Pfad /api/interview/TOK/stream → part:TOK", () => {
    const req = makeReq({ pathname: "/api/interview/TOK/stream" });
    expect(
      deriveRateLimitKey(req, "/api/interview/TOK/stream", "participant"),
    ).toBe("part:TOK");
  });

  it("(c2) open-Pfad /api/interview/open/TOK/speak → part:TOK", () => {
    const req = makeReq({ pathname: "/api/interview/open/TOK/speak" });
    expect(
      deriveRateLimitKey(req, "/api/interview/open/TOK/speak", "participant"),
    ).toBe("part:TOK");
  });

  it("(d) kein req.auth → IP aus x-forwarded-for erstem Element", () => {
    const req = makeReq({
      auth: null,
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(deriveRateLimitKey(req, "/api/research/plans", "mutation")).toBe(
      "ip:1.2.3.4",
    );
  });

  it("(d2) ohne IP-Header → ip:unknown", () => {
    const req = makeReq({ auth: null });
    expect(deriveRateLimitKey(req, "/api/research/plans", "mutation")).toBe(
      "ip:unknown",
    );
  });

  it("(e) SPOOF-PROBE: ein gesetzter x-org-id-Header ändert den Key NICHT", () => {
    // Eingeloggt: Key kommt aus dem signierten req.auth, NICHT aus dem Header.
    const loggedIn = makeReq({
      auth: { user: { id: "u1", orgId: "org_real" } },
      headers: { "x-org-id": "org_attacker", "x-forwarded-for": "9.9.9.9" },
    });
    expect(
      deriveRateLimitKey(loggedIn, "/api/research/plans", "mutation"),
    ).toBe("org:org_real");

    // Anonym: Key kommt aus der Plattform-IP, NICHT aus x-org-id.
    const anon = makeReq({
      auth: null,
      headers: { "x-org-id": "org_attacker", "x-forwarded-for": "9.9.9.9" },
    });
    expect(deriveRateLimitKey(anon, "/api/research/plans", "mutation")).toBe(
      "ip:9.9.9.9",
    );
  });

  it("voiceAgent fällt auf IP (keine Header-Org-Zuordnung)", () => {
    const req = makeReq({
      auth: null,
      headers: { authorization: "Bearer secret", "x-forwarded-for": "2.2.2.2" },
    });
    expect(deriveRateLimitKey(req, "/api/voice/transcript", "voiceAgent")).toBe(
      "ip:2.2.2.2",
    );
  });
});

describe("enforceRateLimit", () => {
  it("exempt-Pfad → null OHNE Upstash zu berühren", async () => {
    vi.stubEnv(URL_ENV, "https://example.upstash.io");
    vi.stubEnv(TOKEN_ENV, "tok");

    const req = makeReq({ pathname: "/api/health", auth: null });
    const out = await enforceRateLimit(req);

    expect(out).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("nicht-/api-Pfad → null (Sicherheitsnetz), kein fetch", async () => {
    vi.stubEnv(URL_ENV, "https://example.upstash.io");
    vi.stubEnv(TOKEN_ENV, "tok");

    const req = makeReq({ pathname: "/dashboard", auth: null });
    const out = await enforceRateLimit(req);

    expect(out).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ohne Env → null (inert, no-op Merge)", async () => {
    vi.stubEnv(URL_ENV, "");
    vi.stubEnv(TOKEN_ENV, "");

    const req = makeReq({
      pathname: "/api/research/plans",
      auth: { user: { id: "u1", orgId: "org_1" } },
    });
    const out = await enforceRateLimit(req);

    expect(out).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("über Limit → Response status 429 mit Retry-After", async () => {
    vi.stubEnv(URL_ENV, "https://example.upstash.io");
    vi.stubEnv(TOKEN_ENV, "tok");
    fetchSpy.mockResolvedValue(upstashOk(RATE_LIMITS.mutation.limit + 1));

    const req = makeReq({
      pathname: "/api/research/plans",
      auth: { user: { id: "u1", orgId: "org_1" } },
    });
    const out = await enforceRateLimit(req);

    expect(out).not.toBeNull();
    expect(out?.status).toBe(429);
    expect(out?.headers.get("Retry-After")).toBe("60");
    expect(out?.headers.get("RateLimit-Limit")).toBe(
      String(RATE_LIMITS.mutation.limit),
    );
    expect(await out?.json()).toEqual({ error: "rate_limited" });
  });

  it("unter Limit → null (durchlassen)", async () => {
    vi.stubEnv(URL_ENV, "https://example.upstash.io");
    vi.stubEnv(TOKEN_ENV, "tok");
    fetchSpy.mockResolvedValue(upstashOk(1));

    const req = makeReq({
      pathname: "/api/research/plans",
      auth: { user: { id: "u1", orgId: "org_1" } },
    });
    const out = await enforceRateLimit(req);

    expect(out).toBeNull();
  });

  it("ein Wurf aus der Key-Ableitung wird gefangen → null (fail-open, kein Middleware-Crash)", async () => {
    vi.stubEnv(URL_ENV, "https://example.upstash.io");
    vi.stubEnv(TOKEN_ENV, "tok");
    // headers.get wirft → der Wurf entsteht in deriveRateLimitKey (IP-Fallback),
    // VOR checkRateLimit. Die äußere try/catch-Klammer MUSS ihn fangen → null.
    const req = {
      auth: null,
      nextUrl: { pathname: "/api/research/plans" },
      headers: {
        get: () => {
          throw new Error("boom");
        },
      },
    } as unknown as NextAuthRequest;

    const out = await enforceRateLimit(req);

    expect(out).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      "[ratelimit] enforce threw, failing open",
      expect.any(Error),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

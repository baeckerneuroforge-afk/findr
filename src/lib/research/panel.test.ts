import { describe, it, expect } from "vitest";

import {
  PANEL_PROVIDER,
  PROLIFIC_PID_PARAM,
  isValidPanelId,
  parsePanelParams,
  coercePanelInbound,
  buildPanelRedirectUrl,
  coercePanelCompletion,
  coercePanelContext,
} from "./panel";

// A realistic Prolific PID (24-char hex, ObjectId-shaped).
const PID = "5e8f1a2b3c4d5e6f7a8b9c0d";

describe("isValidPanelId", () => {
  it("accepts a Prolific 24-hex id", () => {
    expect(isValidPanelId(PID)).toBe(true);
  });
  it("accepts alphanumeric + dash + underscore", () => {
    expect(isValidPanelId("abc-123_XYZ")).toBe(true);
  });
  it("rejects empty / whitespace / non-string", () => {
    expect(isValidPanelId("")).toBe(false);
    expect(isValidPanelId("   ")).toBe(false);
    expect(isValidPanelId(undefined)).toBe(false);
    expect(isValidPanelId(null)).toBe(false);
    expect(isValidPanelId(12345)).toBe(false);
  });
  it("rejects injection / URL-breaking characters", () => {
    expect(isValidPanelId("a b")).toBe(false); // space
    expect(isValidPanelId('a"b')).toBe(false); // quote
    expect(isValidPanelId("a<b>")).toBe(false); // markup
    expect(isValidPanelId("a&b=c")).toBe(false); // query injection
    expect(isValidPanelId("a/b")).toBe(false); // path
    expect(isValidPanelId("a%20b")).toBe(false); // percent
    expect(isValidPanelId("javascript:alert(1)")).toBe(false); // scheme + parens
  });
  it("rejects over-length ids (>100)", () => {
    expect(isValidPanelId("a".repeat(100))).toBe(true);
    expect(isValidPanelId("a".repeat(101))).toBe(false);
  });
});

describe("parsePanelParams", () => {
  it("returns null for no params / no PID (non-panel entry stays byte-identical)", () => {
    expect(parsePanelParams(undefined)).toBeNull();
    expect(parsePanelParams({})).toBeNull();
    expect(parsePanelParams({ foo: "bar" })).toBeNull();
  });
  it("parses a valid PID into a prolific inbound", () => {
    const out = parsePanelParams({ [PROLIFIC_PID_PARAM]: PID });
    expect(out).toEqual({
      provider: PANEL_PROVIDER,
      participantId: PID,
      studyId: null,
      sessionId: null,
    });
  });
  it("carries optional STUDY_ID / SESSION_ID when valid", () => {
    const out = parsePanelParams({
      [PROLIFIC_PID_PARAM]: PID,
      STUDY_ID: "study_123",
      SESSION_ID: "sess_456",
    });
    expect(out?.studyId).toBe("study_123");
    expect(out?.sessionId).toBe("sess_456");
  });
  it("drops malformed optional ids but keeps a valid PID", () => {
    const out = parsePanelParams({
      [PROLIFIC_PID_PARAM]: PID,
      STUDY_ID: "bad id!",
    });
    expect(out?.participantId).toBe(PID);
    expect(out?.studyId).toBeNull();
  });
  it("rejects an invalid PID entirely (treated as non-panel)", () => {
    expect(parsePanelParams({ [PROLIFIC_PID_PARAM]: "bad id!" })).toBeNull();
    expect(parsePanelParams({ [PROLIFIC_PID_PARAM]: "" })).toBeNull();
  });
  it("takes the first value when a param repeats (string[])", () => {
    const out = parsePanelParams({ [PROLIFIC_PID_PARAM]: [PID, "other"] });
    expect(out?.participantId).toBe(PID);
  });
});

describe("coercePanelInbound (server-side trust boundary)", () => {
  it("accepts a valid wire object", () => {
    expect(
      coercePanelInbound({ participantId: PID, studyId: "s1", sessionId: null }),
    ).toEqual({
      provider: PANEL_PROVIDER,
      participantId: PID,
      studyId: "s1",
      sessionId: null,
    });
  });
  it("rejects tampered / invalid pid", () => {
    expect(coercePanelInbound({ participantId: "x'; drop" })).toBeNull();
    expect(coercePanelInbound({ participantId: 123 })).toBeNull();
    expect(coercePanelInbound(null)).toBeNull();
    expect(coercePanelInbound("nope")).toBeNull();
    expect(coercePanelInbound({})).toBeNull();
  });
});

describe("buildPanelRedirectUrl", () => {
  it("uses a Prolific complete URL as-is (no placeholder needed)", () => {
    const url = "https://app.prolific.com/submissions/complete?cc=ABC123";
    expect(buildPanelRedirectUrl(url, PID)).toBe(url + "");
  });
  it("substitutes {PID} for a provider that round-trips the id", () => {
    const tmpl = "https://panel.example.com/return?RID={PID}&status=complete";
    expect(buildPanelRedirectUrl(tmpl, PID)).toBe(
      `https://panel.example.com/return?RID=${PID}&status=complete`,
    );
  });
  it("substitutes every occurrence of {PID}", () => {
    const tmpl = "https://x.test/{PID}/done?id={PID}";
    expect(buildPanelRedirectUrl(tmpl, PID)).toBe(
      `https://x.test/${PID}/done?id=${PID}`,
    );
  });
  it("returns null for empty / nullish templates (→ no redirect)", () => {
    expect(buildPanelRedirectUrl(null, PID)).toBeNull();
    expect(buildPanelRedirectUrl(undefined, PID)).toBeNull();
    expect(buildPanelRedirectUrl("", PID)).toBeNull();
  });
  it("rejects dangerous schemes (no XSS sink at window.location)", () => {
    expect(buildPanelRedirectUrl("javascript:alert(1)", PID)).toBeNull();
    expect(buildPanelRedirectUrl("data:text/html,<script>", PID)).toBeNull();
    expect(buildPanelRedirectUrl("vbscript:msgbox", PID)).toBeNull();
    expect(buildPanelRedirectUrl("file:///etc/passwd", PID)).toBeNull();
  });
  it("rejects relative / unparseable templates", () => {
    expect(buildPanelRedirectUrl("/relative/path", PID)).toBeNull();
    expect(buildPanelRedirectUrl("not a url", PID)).toBeNull();
  });
  it("refuses to build with an invalid participant id", () => {
    expect(
      buildPanelRedirectUrl("https://x.test/?RID={PID}", "bad id!"),
    ).toBeNull();
  });
});

describe("coercePanelCompletion", () => {
  it("narrows a full completion object", () => {
    expect(
      coercePanelCompletion({
        complete_url: "https://a.test/c",
        screenout_url: "https://a.test/s",
        quotafull_url: "https://a.test/q",
      }),
    ).toEqual({
      complete_url: "https://a.test/c",
      screenout_url: "https://a.test/s",
      quotafull_url: "https://a.test/q",
    });
  });
  it("keeps partial config, empty strings → null", () => {
    expect(
      coercePanelCompletion({ complete_url: "https://a.test/c", screenout_url: "" }),
    ).toEqual({
      complete_url: "https://a.test/c",
      screenout_url: null,
      quotafull_url: null,
    });
  });
  it("returns null when nothing is configured", () => {
    expect(coercePanelCompletion(null)).toBeNull();
    expect(coercePanelCompletion({})).toBeNull();
    expect(coercePanelCompletion({ complete_url: "" })).toBeNull();
    expect(coercePanelCompletion("nope")).toBeNull();
  });
});

describe("coercePanelContext", () => {
  it("narrows a full panel_context row", () => {
    expect(
      coercePanelContext({
        provider: "prolific",
        participant_id: PID,
        study_id: "study_1",
        session_id: "sess_1",
        complete_url: "https://app.prolific.com/submissions/complete?cc=A",
      }),
    ).toEqual({
      provider: PANEL_PROVIDER,
      participant_id: PID,
      study_id: "study_1",
      session_id: "sess_1",
      complete_url: "https://app.prolific.com/submissions/complete?cc=A",
    });
  });
  it("returns null without a valid participant_id (non-panel session)", () => {
    expect(coercePanelContext(null)).toBeNull();
    expect(coercePanelContext({})).toBeNull();
    expect(coercePanelContext({ participant_id: "bad id!" })).toBeNull();
    expect(coercePanelContext({ complete_url: "https://x.test" })).toBeNull();
  });
  it("tolerates a missing complete_url (attribution-only, E1 without E2)", () => {
    const out = coercePanelContext({ participant_id: PID });
    expect(out?.participant_id).toBe(PID);
    expect(out?.complete_url).toBeNull();
  });
});

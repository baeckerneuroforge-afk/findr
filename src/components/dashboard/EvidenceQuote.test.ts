import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EvidenceQuote } from "@/components/dashboard/EvidenceQuote";

describe("EvidenceQuote", () => {
  it("renders speaker, role, quote, context, and call date", () => {
    const html = renderToStaticMarkup(
      createElement(EvidenceQuote, {
        quote:
          "Ehrlich gesagt, unser CFO hat da nochmal Fragen zur Datensicherheit.",
        speaker: "Thomas Becker",
        speakerRole: "decision_maker",
        context: "Neue Compliance-Anforderung spät im Prozess eingebracht",
        callDate: "21.05.2026",
      }),
    );

    expect(html).toContain("Thomas Becker");
    expect(html).toContain("Decision Maker");
    expect(html).toContain("Datensicherheit");
    expect(html).toContain("Neue Compliance-Anforderung");
    expect(html).toContain("21.05.2026");
  });

  it("falls back to raw speaker role when role is unknown", () => {
    const html = renderToStaticMarkup(
      createElement(EvidenceQuote, {
        quote: "Wir melden uns dann wieder.",
        speakerRole: "procurement",
      }),
    );

    expect(html).toContain("procurement");
    expect(html).toContain("Wir melden uns dann wieder.");
  });

  it("renders cleanly when optional metadata is absent", () => {
    const html = renderToStaticMarkup(
      createElement(EvidenceQuote, {
        quote: "Salesforce ist preislich aggressiver.",
      }),
    );

    expect(html).toContain("Salesforce ist preislich aggressiver.");
    expect(html).not.toContain("undefined");
  });

  it("uses subtle quote styling", () => {
    const html = renderToStaticMarkup(
      createElement(EvidenceQuote, {
        quote: "Finance braucht eine ROI-Begründung.",
        speaker: "Katrin Wolf",
        speakerRole: "decision_maker",
      }),
    );

    expect(html).toContain("border-primary-200");
    expect(html).toContain("bg-neutral-50");
    expect(html).toContain("bg-primary-50");
  });
});

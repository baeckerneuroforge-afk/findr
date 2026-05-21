import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfidenceIndicator } from "@/components/dashboard/ConfidenceIndicator";

describe("ConfidenceIndicator", () => {
  it("renders high confidence with label and percentage in md mode", () => {
    const html = renderToStaticMarkup(
      createElement(ConfidenceIndicator, { confidence: 0.86, size: "md" }),
    );

    expect(html).toContain("High confidence");
    expect(html).toContain("86%");
    expect(html).toContain("bg-success-500");
    expect(html).toContain('aria-label="High confidence 86%"');
  });

  it("renders medium confidence with primary accent", () => {
    const html = renderToStaticMarkup(
      createElement(ConfidenceIndicator, { confidence: 0.67, size: "md" }),
    );

    expect(html).toContain("Medium confidence");
    expect(html).toContain("67%");
    expect(html).toContain("bg-primary-500");
  });

  it("renders low confidence without visible label in sm mode", () => {
    const html = renderToStaticMarkup(
      createElement(ConfidenceIndicator, { confidence: 0.41 }),
    );

    expect(html).toContain('aria-label="Low confidence 41%"');
    expect(html).toContain("bg-neutral-400");
    expect(html).not.toContain("Low confidence</span>");
  });

  it("clamps confidence values to the supported range", () => {
    const html = renderToStaticMarkup(
      createElement(ConfidenceIndicator, { confidence: 1.4, size: "md" }),
    );

    expect(html).toContain("High confidence");
    expect(html).toContain("100%");
  });
});

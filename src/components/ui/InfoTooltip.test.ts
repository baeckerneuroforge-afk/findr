import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InfoTooltip } from "./InfoTooltip";

describe("InfoTooltip", () => {
  it("renders an accessible info button", () => {
    const html = renderToStaticMarkup(
      createElement(InfoTooltip, {
        label: "Pipeline value adjusted by win probability.",
      }),
    );

    expect(html).toContain('aria-label="Pipeline value adjusted');
    expect(html).toContain(">i</button>");
  });

  it("renders tooltip content", () => {
    const html = renderToStaticMarkup(
      createElement(InfoTooltip, {
        label: "Estimated from deal stage, risk score, and recent engagement.",
      }),
    );

    expect(html).toContain("Estimated from deal stage");
    expect(html).toContain('role="tooltip"');
  });

  it("uses subtle neutral styling with primary focus accents", () => {
    const html = renderToStaticMarkup(
      createElement(InfoTooltip, { label: "Helpful context" }),
    );

    expect(html).toContain("border-neutral-300");
    expect(html).toContain("focus:border-primary-400");
  });
});

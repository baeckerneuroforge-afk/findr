import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and description", () => {
    const html = renderToStaticMarkup(
      createElement(EmptyState, {
        title: "No deals yet",
        description: "Connect Hubspot to start importing your pipeline.",
      }),
    );

    expect(html).toContain("No deals yet");
    expect(html).toContain("Connect Hubspot");
  });

  it("renders CTA link only when cta is provided", () => {
    const html = renderToStaticMarkup(
      createElement(EmptyState, {
        title: "No open deals",
        description: "Active pipeline will appear here.",
        cta: { label: "Go to pipeline", href: "/dashboard" },
      }),
    );

    expect(html).toContain("Go to pipeline");
    expect(html).toContain('href="/dashboard"');
  });

  it("omits CTA markup when no action is provided", () => {
    const html = renderToStaticMarkup(
      createElement(EmptyState, {
        title: "Nothing here",
        description: "There is no data yet.",
      }),
    );

    expect(html).not.toContain("<a");
    expect(html).not.toContain("<button");
  });

  it("keeps backward-compatible action links", () => {
    const html = renderToStaticMarkup(
      createElement(EmptyState, {
        title: "No losses",
        description: "Closed-lost deals will appear here.",
        action: { label: "Review pipeline", href: "/dashboard" },
      }),
    );

    expect(html).toContain("Review pipeline");
    expect(html).toContain('href="/dashboard"');
  });
});

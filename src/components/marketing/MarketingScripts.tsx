"use client";

import { useEffect } from "react";

/**
 * Runs a marketing page's verbatim inline JS (scroll reveals, the interactive
 * live-analysis + solution-PDF builders, the journey/voice/integration
 * animations, count-ups). The source script is injected as a real <script>
 * element on mount so it executes against the already-rendered markup, and is
 * re-run on every mount — so the animations also work after client-side
 * navigation back to the page. Cleanup removes the injected element.
 */
export function MarketingScripts({ js }: { js: string }) {
  useEffect(() => {
    if (!js) return;
    const el = document.createElement("script");
    el.textContent = js;
    document.body.appendChild(el);
    return () => {
      el.remove();
    };
  }, [js]);

  return null;
}

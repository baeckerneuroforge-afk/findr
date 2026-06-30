import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import { analyzeProductDiscovery } from "@/lib/product-discovery/classifier";
import { appendVisualCaptureToTranscript } from "@/lib/visual-intelligence/vision";
import { synthesizeFromInputs } from "@/lib/synthesis/engine";
import type { SynthesisInsightInput } from "@/lib/synthesis/prompts";

function fold(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/Ä/g, "Ae")
    .replace(/ä/g, "ae")
    .replace(/Ö/g, "Oe")
    .replace(/ö/g, "oe")
    .replace(/Ü/g, "Ue")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/["'„“”«»‘’‚‹›]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function collectStrings(value: unknown, sink: string[]): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    sink.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, sink);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStrings(item, sink);
    }
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const visualLine =
  '- [00:08] Der Bildschirm zeigt im Export-Dialog die Fehlermeldung "Export fehlgeschlagen"; der Cursor klickt zweimal erneut auf den Export-Button.';

const transcript = [
  "Assistant: Was ist Ihnen beim Reporting wichtig?",
  "Customer: Wir brauchen ein Dashboard fuer den CFO.",
].join("\n");

const visualCapture = {
  version: 1,
  textBlock: [
    "## Visuelle Beobachtungen",
    "VISUAL_CAPTURE_START",
    "Source: manual_file (llm-smoke.mp4)",
    "Model: claude-sonnet-5",
    "Sampling: 1 frame every 8s, 1 frame(s) total",
    visualLine,
    "VISUAL_CAPTURE_END",
  ].join("\n"),
};

function anchoredQuotes(insights: SynthesisInsightInput[]): string {
  const parts: string[] = [];
  for (const insight of insights) {
    if (insight.summary) parts.push(insight.summary);
    collectStrings(insight.featureRequests, parts);
    collectStrings(insight.painPoints, parts);
    collectStrings(insight.themes, parts);
  }
  return fold(parts.join("\n"));
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  const stage1Model =
    process.env.VI_STAGE1_MODEL ??
    process.env.PRODUCT_DISCOVERY_MODEL ??
    CLAUDE_MODELS.sonnet;
  const stage2Model =
    process.env.VI_SYNTHESIS_MODEL ??
    process.env.SYNTHESIS_MODEL ??
    CLAUDE_MODELS.sonnet;

  const transcriptWithVisual = appendVisualCaptureToTranscript(
    transcript,
    visualCapture,
  );

  console.log(`Stage 1 model: ${stage1Model}`);
  const stage1 = await analyzeProductDiscovery(
    { transcript: transcriptWithVisual },
    stage1Model,
  );
  const visualPainPoints = stage1.painPoints.filter(
    (pp) => pp.category === "VISUAL_OBSERVATION",
  );
  const visualHit = visualPainPoints.some((pp) =>
    pp.evidence.some((evidence) => fold(visualLine).includes(fold(evidence))),
  );
  if (!visualHit) {
    console.log("Stage 1 output:");
    console.log(JSON.stringify(stage1, null, 2));
  }
  assert(
    visualHit,
    "Stage 1 did not preserve the visual observation as anchored evidence.",
  );

  const foldedTranscript = fold(transcriptWithVisual);
  for (const item of [...stage1.featureRequests, ...stage1.painPoints]) {
    for (const evidence of item.evidence) {
      assert(
        foldedTranscript.includes(fold(evidence)),
        `Unanchored Stage-1 evidence: ${evidence}`,
      );
    }
  }

  const insightA: SynthesisInsightInput = {
    id: "call_vi_a",
    summary: stage1.summary,
    featureRequests: [],
    painPoints: visualPainPoints,
    themes: [],
    respondentRole: null,
    respondentSegment: null,
    sentiment: "neutral",
  };
  const insightB: SynthesisInsightInput = {
    ...insightA,
    id: "call_vi_b",
  };
  const insights = [insightA, insightB];
  const haystack = anchoredQuotes(insights);

  console.log(`Stage 2 model: ${stage2Model}`);
  const stage2 = await synthesizeFromInputs(
    {
      plan: {
        title: "VI Stage-1 LLM Smoke",
        objective: "Confirm visual notes survive into anchored synthesis",
        persona: null,
      },
      insights,
    },
    stage2Model,
  );

  for (const theme of stage2.emergent_themes) {
    for (const quote of theme.quotes) {
      assert(haystack.includes(fold(quote)), `Unanchored Stage-2 quote: ${quote}`);
    }
  }
  for (const tension of stage2.tensions) {
    for (const side of [tension.side_a, tension.side_b]) {
      for (const quote of side.quotes) {
        assert(
          haystack.includes(fold(quote)),
          `Unanchored Stage-2 tension quote: ${quote}`,
        );
      }
    }
  }

  assert(
    stage2.emergent_themes.some(
      (theme) =>
        theme.quotes.some((quote) => fold(quote) === fold(visualLine)) ||
        fold(theme.summary).includes("export"),
    ),
    "Stage 2 did not carry the visual export signal into a theme.",
  );

  console.log("VI Stage-1 LLM smoke PASS");
  console.log(
    `Stage 1: ${stage1.featureRequests.length} FR, ${stage1.painPoints.length} PP, visual=${visualPainPoints.length}`,
  );
  console.log(
    `Stage 2: ${stage2.emergent_themes.length} theme(s), ${stage2.tensions.length} tension(s), all quotes anchored`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

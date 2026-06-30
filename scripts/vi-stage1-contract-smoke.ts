import {
  ProductDiscoveryResultSchema,
  ProductDiscoveryWithVisualResultSchema,
} from "@/lib/schemas/product-discovery";
import {
  PRODUCT_DISCOVERY_SYSTEM_PROMPT,
  PRODUCT_DISCOVERY_VISUAL_SYSTEM_PROMPT,
  buildProductDiscoveryPrompt,
  hasVisualObservationsBlock,
} from "@/lib/product-discovery/prompts";
import { buildSynthesisUserPrompt } from "@/lib/synthesis/prompts";
import { appendVisualCaptureToTranscript } from "@/lib/visual-intelligence/vision";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

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

const transcript = [
  "Assistant: Was ist Ihnen beim Reporting wichtig?",
  "Customer: Wir brauchen ein Dashboard fuer den CFO.",
].join("\n");

const visualLine =
  "- [00:08] Der Bildschirm zeigt wiederholt die Export-Ansicht; der Cursor bewegt sich zwischen Filter und Export-Button.";

const visualCapture = {
  version: 1,
  textBlock: [
    "## Visuelle Beobachtungen",
    "VISUAL_CAPTURE_START",
    "Source: manual_file (sample.mp4)",
    "Model: claude-sonnet-5",
    "Sampling: 1 frame every 8s, 1 frame(s) total",
    visualLine,
    "VISUAL_CAPTURE_END",
  ].join("\n"),
};

const unchanged = appendVisualCaptureToTranscript(transcript, null);
assert(
  unchanged === transcript,
  "Non-visual transcript changed while appending null visual_capture.",
);
assert(
  !hasVisualObservationsBlock(unchanged),
  "Non-visual transcript unexpectedly activates visual classifier path.",
);

const basePrompt = buildProductDiscoveryPrompt({ transcript });
const basePromptAgain = buildProductDiscoveryPrompt({ transcript: unchanged });
assert(basePromptAgain === basePrompt, "Non-visual Stage-1 prompt changed.");
assert(
  PRODUCT_DISCOVERY_VISUAL_SYSTEM_PROMPT.startsWith(
    PRODUCT_DISCOVERY_SYSTEM_PROMPT,
  ),
  "Visual system prompt must extend the base prompt, not replace it.",
);

const visualTranscript = appendVisualCaptureToTranscript(
  transcript,
  visualCapture,
);
assert(
  visualTranscript !== transcript &&
    hasVisualObservationsBlock(visualTranscript),
  "Visual transcript did not activate visual classifier path.",
);
assert(
  visualTranscript.includes(visualLine),
  "Visual evidence line missing from appended transcript.",
);

const visualResult = {
  featureRequests: [],
  painPoints: [
    {
      category: "VISUAL_OBSERVATION",
      title: "Export-Ansicht wiederholt sichtbar",
      description:
        "Die visuelle Notiz zeigt wiederholte Bewegung zwischen Filter und Export-Button, ohne eine Absicht zu unterstellen.",
      severity: "low",
      confidence: 0.8,
      evidence: [visualLine],
      source: "visual",
    },
  ],
  themes: [],
  summary:
    "Das Transkript nennt einen CFO-Dashboard-Wunsch; der visuelle Block liefert getrennte Export-Interaktionsnotizen.",
  respondentRole: null,
  respondentSegment: null,
  sentiment: "neutral",
  source: "transcript",
};

assert(
  !ProductDiscoveryResultSchema.safeParse(visualResult).success,
  "Base Stage-1 schema accepted VISUAL_OBSERVATION.",
);
assert(
  ProductDiscoveryWithVisualResultSchema.safeParse(visualResult).success,
  "Visual Stage-1 schema rejected VISUAL_OBSERVATION.",
);

const synthesisPrompt = buildSynthesisUserPrompt({
  plan: {
    title: "VI Contract Smoke",
    objective: "Check visual Stage-1 anchoring",
    persona: null,
  },
  insights: [
    {
      id: "call_vi_1",
      summary: visualResult.summary,
      featureRequests: visualResult.featureRequests,
      painPoints: visualResult.painPoints,
      themes: visualResult.themes,
      respondentRole: null,
      respondentSegment: null,
      sentiment: "neutral",
    },
  ],
});

assert(
  fold(synthesisPrompt).includes(fold(visualLine)),
  "Stage-2 prompt does not carry the visual evidence line.",
);

console.log("VI Stage-1 contract smoke PASS");
console.log("- non-visual transcript/prompt unchanged");
console.log("- base schema rejects VISUAL_OBSERVATION");
console.log("- visual schema accepts VISUAL_OBSERVATION");
console.log("- Stage-2 input carries visual evidence for the existing anchor filter");

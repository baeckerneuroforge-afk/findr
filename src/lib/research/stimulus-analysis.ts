import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import { callClaudeStructured } from "@/lib/anthropic/structured";
import type { ResearchTopic } from "@/lib/voice-agent/interviewer";

/**
 * Stimulus-Analyse (Vision) — die EINMALIGE Analyse eines hochgeladenen
 * Studien-Stimulus. Claude (multimodal) beschreibt das Material dicht und
 * strukturiert (Layout, Farbwelt, Bildelemente, Text im Bild, Claim,
 * Gestaltungsentscheidungen) und leitet 3–5 studienspezifische Frageansätze
 * ab. Das Ergebnis wird als versioniertes Envelope auf research_plans
 * persistiert (stimulus_analysis jsonb, Migration 20260703000007) und fließt
 * über planToAgentContext → formatStimulus als Nachhak-Material in den
 * Interview-Kontext — es ERGÄNZT die Forscher-Topics, ersetzt sie nie.
 *
 * Etappe 3 ergänzt VIDEO-Stimuli: der Browser extrahiert clientseitig 8–16
 * gleichmäßig gesampelte Keyframes (kein ffmpeg serverseitig), die Route reicht
 * sie als EINE Multi-Image-Analyse hierher durch. Gleiches Envelope, additiv
 * um `verlauf`/`szenen` erweitert (beide optional — Bild-Envelopes parsen
 * unverändert). Die Frames sind ein reines Transport-Artefakt und werden NIE
 * persistiert; gespeichert wird nur das Video (Bucket) + dieses Envelope.
 *
 * Trigger: AUSSCHLIESSLICH der Upload in der Stimulus-Route (fail-open —
 * ein Analysefehler lässt den Upload trotzdem gelingen, Status 'failed').
 * Interview-Pfade lösen NIE eine Analyse aus; ohne Analyse rendert der Prompt
 * exakt wie heute.
 *
 * Modell: Opus default (gleiche Abwägung wie guide-generator — einmalig pro
 * Studie, und die Qualität multipliziert sich in jedes Interview der Studie).
 * Override via STIMULUS_ANALYSIS_MODEL — Pattern wie GUIDE_GEN_MODEL.
 *
 * Anti-Halluzination wie vision.ts: nur beschreiben, was sichtbar ist;
 * Frageansätze neutral und nicht suggestiv (Anti-Leading wie im
 * Interviewer-CORE).
 */

export const DEFAULT_STIMULUS_ANALYSIS_MODEL = CLAUDE_MODELS.opus;

/** Harte Obergrenze für den gerenderten Prompt-Block. Einmal HIER beim
 *  Schreiben gekappt — alles stromabwärts (dealContext-Snapshot, Text- und
 *  Voice-Kontext) konsumiert den bereits begrenzten String.
 *  2500 → 3000 mit Etappe 3 (Freigabe O2): Video-Analysen tragen zusätzlich
 *  Verlauf + Szenen; die Szenen rendern bewusst NACH den Frageansätzen, damit
 *  die Kappung (sie schneidet vom Ende) nie die Frageansätze frisst. */
export const MAX_TEXT_BLOCK_CHARS = 3000;

// ── Output-Schema ──────────────────────────────────────────────────────────

export const StimulusAnalysisSchema = z.object({
  /** Aufbau/Komposition: Bildaufteilung, visuelle Hierarchie, Blickführung. */
  layout: z.string().min(1).max(600),
  /** Farbwelt und Anmutung (dominante Farben, Kontraste, Stimmung). */
  farbwelt: z.string().min(1).max(400),
  /** Zentrale sichtbare Bildelemente (Personen, Produkte, Grafiken, Logos). */
  bildelemente: z.array(z.string().min(1).max(200)).min(1).max(10),
  /** Sichtbarer Text im Bild, wörtlich (OCR-artig). Leer wenn textfrei. */
  textImBild: z.array(z.string().min(1).max(200)).max(15).default([]),
  /** Wahrgenommene Kernbotschaft / Claim des Materials. */
  claimBotschaft: z.string().min(1).max(400),
  /** Auffällige Gestaltungsentscheidungen (bewusste Brüche, Stilmittel). */
  gestaltungsentscheidungen: z.array(z.string().min(1).max(300)).max(8),
  /** 3–5 studienspezifische, NEUTRALE Frageansätze (Nachhak-Material). */
  frageansaetze: z.array(z.string().min(1).max(300)).min(3).max(5),
});

/** Eine sichtbare Szene im Video, verankert am Zeitstempel des Frames. */
export const StimulusSzeneSchema = z.object({
  /** Zeitstempel des Frames, an dem die Szene sichtbar ist ("mm:ss"). */
  zeit: z.string().min(1).max(20),
  /** Knappe, rein sichtbare Beschreibung der Szene. */
  beschreibung: z.string().min(1).max(200),
});

/** Video-Variante: das Bild-Schema PLUS zeitlicher Verlauf. Beide Zusatzfelder
 *  sind OPTIONAL — damit ist dieses Schema ein echtes Superset: jedes
 *  persistierte Bild-Envelope (ohne die Felder) parst unverändert, und der
 *  Bild-Aufruf (analyzeStimulusImage) behält sein unverändertes Tool-Schema
 *  (StimulusAnalysisSchema) → Bild-Request byte-identisch. */
export const StimulusVideoAnalysisSchema = StimulusAnalysisSchema.extend({
  /** Dramaturgie über die Laufzeit in 1–2 Sätzen (nur Video). */
  verlauf: z.string().min(1).max(400).optional(),
  /** 2–8 Szenen mit Frame-Zeitstempel (nur Video). */
  szenen: z.array(StimulusSzeneSchema).min(2).max(8).optional(),
});

export type StimulusAnalysis = z.infer<typeof StimulusVideoAnalysisSchema>;

// ── Persistenz-Envelope ────────────────────────────────────────────────────

/** Versioniertes jsonb-Envelope (Vorbild: VisualCapturePayload in vision.ts).
 *  textBlock ist der fertig gerenderte, längenbegrenzte Prompt-Abschnitt —
 *  einmal beim Schreiben erzeugt, damit der Render-Pfad trivial bleibt. */
export const StimulusAnalysisPayloadSchema = z.object({
  version: z.literal(1),
  model: z.string().min(1),
  generatedAt: z.string().min(1),
  // Superset-Schema (verlauf/szenen optional): trägt Bild- UND Video-Analysen
  // in derselben Version — Bestandszeilen ohne die Felder parsen unverändert.
  analysis: StimulusVideoAnalysisSchema,
  textBlock: z.string().min(1),
});

export type StimulusAnalysisPayload = z.infer<
  typeof StimulusAnalysisPayloadSchema
>;

export type StimulusAnalysisStatus = "pending" | "done" | "failed";

/** Defensive Lese-Mapper (fail-open, Muster coerceStudyType): alles, was nicht
 *  exakt als Envelope parst — inkl. undefined vor angewandter Migration —
 *  liest als null, d. h. Prompt-Verhalten wie heute. Nie ein Throw. */
export function coerceStimulusAnalysis(
  raw: unknown,
): StimulusAnalysisPayload | null {
  const parsed = StimulusAnalysisPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function coerceStimulusAnalysisStatus(
  raw: unknown,
): StimulusAnalysisStatus | null {
  return raw === "pending" || raw === "done" || raw === "failed" ? raw : null;
}

// ── Prompt-Block-Rendering ─────────────────────────────────────────────────

/** Rendert die Analyse als kompakten deutschen Prompt-Block und kappt hart bei
 *  MAX_TEXT_BLOCK_CHARS. Exported for unit tests. */
export function renderStimulusAnalysisTextBlock(
  analysis: StimulusAnalysis,
): string {
  const lines: string[] = [
    `Layout/Aufbau: ${analysis.layout}`,
    `Farbwelt: ${analysis.farbwelt}`,
    `Bildelemente: ${analysis.bildelemente.join("; ")}`,
  ];
  if (analysis.textImBild.length > 0) {
    lines.push(
      `Text im Bild (wörtlich): ${analysis.textImBild
        .map((t) => `"${t}"`)
        .join(" | ")}`,
    );
  }
  lines.push(`Claim/Botschaft: ${analysis.claimBotschaft}`);
  if (analysis.gestaltungsentscheidungen.length > 0) {
    lines.push(
      `Auffällige Gestaltungsentscheidungen: ${analysis.gestaltungsentscheidungen.join("; ")}`,
    );
  }
  if (analysis.verlauf) {
    lines.push(`Zeitlicher Verlauf: ${analysis.verlauf}`);
  }
  lines.push(
    "Mögliche Frageansätze (neutral, optional — nur nutzen, wo sie zum aktuellen Topic passen):",
    ...analysis.frageansaetze.map((q, i) => `${i + 1}. ${q}`),
  );
  // Szenen bewusst ZULETZT (Freigabe O2): die Kappung unten schneidet vom
  // Ende — so frisst sie im Grenzfall Szenen-Detail, nie die Frageansätze.
  // Bild-Analysen (ohne verlauf/szenen) rendern byte-identisch wie bisher.
  if (analysis.szenen && analysis.szenen.length > 0) {
    lines.push(
      "Szenen (Zeitverlauf):",
      ...analysis.szenen.map((s) => `[${s.zeit}] ${s.beschreibung}`),
    );
  }

  const block = lines.join("\n");
  return block.length > MAX_TEXT_BLOCK_CHARS
    ? `${block.slice(0, MAX_TEXT_BLOCK_CHARS - 1)}…`
    : block;
}

// ── Analyse-Aufruf ─────────────────────────────────────────────────────────

export type StimulusImageMediaType = "image/png" | "image/jpeg" | "image/webp";

/** Minimaler Studien-Kontext für studienspezifische Frageansätze. Bewusst eine
 *  EIGENE schmale Form (kein plans-service-Import → kein Import-Zyklus:
 *  plans-service importiert die Coerce-Mapper aus diesem Modul). */
export interface StimulusStudyContext {
  title: string;
  objective: string;
  topics: ResearchTopic[];
  useCase?: string | null;
  stimulusDescription?: string | null;
}

const ANALYSIS_SYSTEM_PROMPT = `Du analysierst ein visuelles Stimulus-Material (z. B. Anzeige, Packung, Landingpage, Konzept-Visual) für eine Marktforschungsstudie. Deine Analyse wird einem KI-Interviewer als Nachhak-Material gegeben, damit er Teilnehmer konkret zum gezeigten Design befragen kann.

GROUNDING-DISZIPLIN (nicht verhandelbar):
- Beschreibe NUR, was im Bild sichtbar ist. Erfinde keine Elemente, keinen Text, keine Marken, keine Wirkungen.
- Text im Bild wörtlich wiedergeben; wenn unleserlich oder kein Text vorhanden, das Feld leer lassen statt zu raten.
- Keine Qualitätsurteile ("gelungen", "schwach") — beschreibe Gestaltung neutral und konkret.
- Schreibe dicht und kompakt; kurze Stichpunkt-Sätze statt Prosa.

FRAGEANSÄTZE (3–5):
- Studienspezifisch: leite sie aus dem Studienziel und den Topics ab, bezogen auf konkrete sichtbare Elemente des Materials.
- Streng NEUTRAL und nicht suggestiv: keine Ja/Nein-Fragen, keine Antwortoptionen, keine unterstellte Wirkung ("Finden Sie die Headline ansprechend?" ist verboten). Offene Formulierungen wie "Was fällt Ihnen an … zuerst auf?", "Was verstehen Sie unter …?".
- Keine direkten "Warum?"-Fragen.

Antworte vollständig auf Deutsch.`;

const VIDEO_ANALYSIS_SYSTEM_PROMPT = `Du analysierst ein Video-Stimulus-Material (z. B. Werbespot, Konzept-Clip, Produktvideo) für eine Marktforschungsstudie. Du siehst NICHT das Video selbst, sondern gleichmäßig über die Laufzeit gesampelte Einzelframes mit Zeitstempeln. Deine Analyse wird einem KI-Interviewer als Nachhak-Material gegeben, damit er Teilnehmer konkret zum gezeigten Video befragen kann.

GROUNDING-DISZIPLIN (nicht verhandelbar):
- Beschreibe NUR, was in den Frames sichtbar ist. Erfinde keine Elemente, keinen Text, keine Marken, keine Wirkungen — und keine Handlung ZWISCHEN den Frames: bei sichtbaren Sprüngen (Szenenwechsel) beide Zustände beschreiben, keinen Übergang erfinden.
- Text im Bild wörtlich wiedergeben; wenn unleserlich oder kein Text vorhanden, das Feld leer lassen statt zu raten.
- Keine Qualitätsurteile ("gelungen", "schwach") — beschreibe Gestaltung neutral und konkret.
- Schreibe dicht und kompakt; kurze Stichpunkt-Sätze statt Prosa.

ZEITLICHER VERLAUF (nur aus den Frames):
- verlauf: 1–2 Sätze, wie sich das Material über die Laufzeit entwickelt — streng auf das in den Frames Sichtbare gestützt.
- szenen: 2–8 Einträge. zeit ist der Zeitstempel ("mm:ss") des Frames, an dem die Szene sichtbar ist (nutze die mitgelieferten Frame-Zeitstempel); beschreibung knapp und rein sichtbar.

FRAGEANSÄTZE (3–5):
- Studienspezifisch: leite sie aus dem Studienziel und den Topics ab, bezogen auf konkrete sichtbare Elemente oder Momente des Videos.
- Streng NEUTRAL und nicht suggestiv: keine Ja/Nein-Fragen, keine Antwortoptionen, keine unterstellte Wirkung ("Finden Sie die Headline ansprechend?" ist verboten). Offene Formulierungen wie "Was fällt Ihnen an … zuerst auf?", "Was verstehen Sie unter …?".
- Keine direkten "Warum?"-Fragen.

Antworte vollständig auf Deutsch.`;

function formatStudyContext(
  study: StimulusStudyContext,
  kind: "image" | "video" = "image",
): string {
  const topicLines =
    study.topics.length > 0
      ? study.topics.map((t) => `- ${t.topic}: ${t.intent}`).join("\n")
      : "- (keine Topics definiert)";
  const description = study.stimulusDescription?.trim();
  const closing =
    kind === "video"
      ? "Analysiere das folgende Stimulus-Video anhand der gesampelten Frames und gib die strukturierte Analyse über das Tool zurück."
      : "Analysiere das folgende Stimulus-Bild und gib die strukturierte Analyse über das Tool zurück.";

  return `STUDIEN-KONTEXT (für studienspezifische Frageansätze):
Titel:    ${study.title}
Ziel:     ${study.objective}${study.useCase ? `\nUse-Case: ${study.useCase}` : ""}
Topics:
${topicLines}${description ? `\nForscher-Beschreibung des Stimulus: ${description}` : ""}

${closing}`;
}

/**
 * Analysiert ein Stimulus-Bild EINMALIG und liefert das persistierbare
 * Envelope. Wirft bei Transport-/Schema-Fehlern (Forced-Tool-Use +
 * 1 Schema-Retry via callClaudeStructured) — der Aufrufer (Stimulus-Route)
 * bleibt fail-open und mappt den Throw auf Status 'failed'.
 *
 * Bildbehandlung: die Upload-Pipeline garantiert bereits png/jpeg/webp ≤ 5 MB
 * mit Signaturprüfung; >1568 px lange Kante skaliert die API selbst herunter —
 * kein eigenes Resizing nötig.
 */
export async function analyzeStimulusImage(params: {
  imageBase64: string;
  mediaType: StimulusImageMediaType;
  study: StimulusStudyContext;
  model?: string;
}): Promise<StimulusAnalysisPayload> {
  const model =
    params.model ??
    process.env.STIMULUS_ANALYSIS_MODEL ??
    DEFAULT_STIMULUS_ANALYSIS_MODEL;

  const analysis = await callClaudeStructured({
    schema: StimulusAnalysisSchema,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: formatStudyContext(params.study) },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: params.mediaType,
              data: params.imageBase64,
            },
          },
        ],
      },
    ],
    model,
    maxTokens: 2000,
    toolName: "emit_stimulus_analysis",
    toolDescription:
      "Gib die strukturierte Stimulus-Analyse zurück. Rufe das Tool genau einmal mit der vollständigen Analyse auf.",
    timeoutMs: 100_000,
    maxRetries: 1,
  });

  return {
    version: 1,
    model,
    generatedAt: new Date().toISOString(),
    analysis,
    textBlock: renderStimulusAnalysisTextBlock(analysis),
  };
}

// ── Video-Analyse (Etappe 3) ───────────────────────────────────────────────

/** Ein clientseitig extrahierter Keyframe — reines Transport-Artefakt: wird
 *  analysiert und danach verworfen, NIE persistiert. `data` ist rohes base64
 *  ohne data-URL-Präfix (die Route validiert das per Regex). */
export interface StimulusVideoFrameInput {
  index: number;
  timestampSeconds: number;
  mediaType: StimulusImageMediaType;
  data: string;
}

function formatFrameTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Analysiert ein Stimulus-Video EINMALIG anhand seiner gesampelten Keyframes
 * (eine Multi-Image-Message, Muster describeFrames in vision.ts) und liefert
 * dasselbe persistierbare Envelope wie der Bild-Pfad — zusätzlich mit
 * verlauf/szenen (Schema-Superset). Wirft wie analyzeStimulusImage; der
 * Aufrufer (Stimulus-Route) bleibt fail-open und mappt auf Status 'failed'.
 *
 * Frames kommen bereits ≤1280 px lange Kante aus dem Browser — bewusst unter
 * der High-Res-Schwelle von Opus 4.7, damit ein Frame ~1,2k Tokens kostet
 * statt bis zu ~4,8k (kein eigenes Resizing nötig).
 */
export async function analyzeStimulusVideo(params: {
  frames: StimulusVideoFrameInput[];
  study: StimulusStudyContext;
  model?: string;
}): Promise<StimulusAnalysisPayload> {
  if (params.frames.length === 0) {
    throw new Error("analyzeStimulusVideo requires at least one frame.");
  }
  const model =
    params.model ??
    process.env.STIMULUS_ANALYSIS_MODEL ??
    DEFAULT_STIMULUS_ANALYSIS_MODEL;

  const content: Anthropic.ContentBlockParam[] = [
    { type: "text", text: formatStudyContext(params.study, "video") },
  ];
  for (const frame of params.frames) {
    content.push({
      type: "text",
      text: `Frame ${frame.index + 1}, ca. [${formatFrameTimestamp(
        frame.timestampSeconds,
      )}]`,
    });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: frame.mediaType,
        data: frame.data,
      },
    });
  }

  const analysis = await callClaudeStructured({
    schema: StimulusVideoAnalysisSchema,
    system: VIDEO_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
    model,
    // Mehr Output-Raum als der Bild-Pfad (2000): verlauf + bis zu 8 Szenen.
    maxTokens: 3000,
    toolName: "emit_stimulus_analysis",
    toolDescription:
      "Gib die strukturierte Stimulus-Analyse zurück. Rufe das Tool genau einmal mit der vollständigen Analyse auf.",
    timeoutMs: 100_000,
    maxRetries: 1,
  });

  return {
    version: 1,
    model,
    generatedAt: new Date().toISOString(),
    analysis,
    textBlock: renderStimulusAnalysisTextBlock(analysis),
  };
}

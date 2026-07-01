import { z } from "zod";

/**
 * Usability TASK model — Phase 1 of the UX-research / usability module
 * (docs/klymeo-ux-research-integration-plan-2026-06-22.md, L1/L2).
 *
 * This module is the SINGLE source of truth for the per-study usability task
 * shape, shared by the routes (strict input validation, TaskDefinitionSchema),
 * the service (DB write/read, via plans-service coerceTaskDefinition reads), and
 * the form (UI options, PROTOTYPE_HOSTING + the type). It is deliberately
 * CLIENT-SAFE — no "server-only" import, only zod — so the client form can
 * import the type and the hosting list without pulling in the server DB layer.
 *
 * Phase 1 is information-only: a usability study carries ONE task; NO event /
 * consent / capture machinery lives here (that is Phase 2, legally gated). The
 * task is metadata that briefs the AI interviewer and (Phase 1b) the
 * participant prototype surface — it never instruments the device.
 */

/**
 * Where the prototype-under-test lives. Drives the cross-origin strategy
 * (integration plan §4): first-party iframe is the primary, controllable path
 * (only there can Phase-2 masking be enforced); external_url is the participant
 * opening a real page; screen_share is the existing off-by-default screen
 * sampling fallback. v1 stores the intent only — no capture is wired in Phase 1.
 * 'figma_embed' is intentionally OUT of v1 (third-party actor / Chapter-V
 * transfer — integration plan §9 C-E).
 */
export const PROTOTYPE_HOSTING = [
  "first_party_iframe",
  "external_url",
  "screen_share",
] as const;

export type PrototypeHosting = (typeof PROTOTYPE_HOSTING)[number];

/**
 * v1 single-task shape (object, not array — multi-task is an additive later
 * change). Persisted as soft jsonb on research_plans.task_definition; the shape
 * is validated here, NOT by a DB CHECK.
 */
export interface TaskDefinition {
  /** What the participant is asked to do (the task prompt). */
  instruction: string;
  /** Optional success criterion the researcher judges/measures against; null
   *  when the task is observational only. */
  successCriterion: string | null;
  /** Optional URL of the prototype / page under test; null when none. http(s)
   *  only (same XSS posture as stimulusUrl). */
  targetUrl: string | null;
  /** How the prototype is hosted/shown. */
  prototypeHosting: PrototypeHosting;
}

/**
 * Phase 1b — the PARTICIPANT-SAFE slice of a task: ONLY the fields a participant
 * may see. successCriterion is deliberately absent — it is researcher-only (the
 * criterion is the measurement target; showing it would bias the participant,
 * same demand-effect discipline as stimulus_description / the agent `why`
 * rationale). Encoding the boundary as a TYPE means the participant payload
 * structurally cannot carry it. The participant page builds this from the live
 * plan's taskDefinition (instruction + targetUrl + embed).
 *
 * `embed` (B1, UX-Engine-Fixes 2026-07-02) ist die einzige Ableitung aus dem
 * researcher-seitigen prototypeHosting, die der Teilnehmer braucht: true ⇔
 * hosting === 'first_party_iframe' UND targetUrl gesetzt → die Interview-Seite
 * rendert den Prototyp als iframe-Panel (nur dort sind Klicks messbar); false
 * → „Prototyp öffnen"-Link im neuen Tab. Kein Bias-Risiko — es steuert nur die
 * Darstellungsform, nie den Messmaßstab.
 */
export interface ParticipantTask {
  instruction: string;
  targetUrl: string | null;
  embed: boolean;
}

/**
 * Kanonische Ableitung des participant-safe Task-Slices aus der vollen
 * TaskDefinition (Server-seitig auf der Teilnehmer-Seite aufzurufen).
 * null-Definition → null (kein Task, nichts gerendert).
 */
export function toParticipantTask(
  task: TaskDefinition | null | undefined,
): ParticipantTask | null {
  if (!task || task.instruction.trim() === "") return null;
  return {
    instruction: task.instruction,
    targetUrl: task.targetUrl,
    embed: task.prototypeHosting === "first_party_iframe" && !!task.targetUrl,
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Strict input schema for the create/update routes (and reusable for client
 * validation). Empty strings normalise to null; a present targetUrl MUST be
 * http(s) (mirrors the stimulusUrl route's stored-XSS guard). The inferred
 * output type is exactly TaskDefinition.
 */
export const TaskDefinitionSchema = z.object({
  instruction: z.string().trim().min(3).max(2000),
  successCriterion: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .default(null)
    .transform((v) => (v && v.length > 0 ? v : null)),
  targetUrl: z
    .string()
    .trim()
    .max(2048)
    .nullable()
    .default(null)
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || isHttpUrl(v), {
      message: "targetUrl must be a valid http(s) URL or empty.",
    }),
  // Default konsistent über alle Schichten (Wizard/Form/API — Lehre aus dem
  // Wizard-Berater-Cap-Bug): external_url ist der ehrliche Default; iframe-
  // Embedding ist ein explizites Opt-in für einbettbare Seiten.
  prototypeHosting: z.enum(PROTOTYPE_HOSTING).default("external_url"),
});

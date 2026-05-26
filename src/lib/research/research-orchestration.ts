import "server-only";

import { getOrgName } from "@/lib/auth/org";
import { getOrgSettings } from "@/lib/settings/org-settings";
import {
  createInterviewSession,
  type InterviewSession,
} from "@/lib/voice-agent/session-service";
import type {
  ResearchBrand,
  ResearchInput,
} from "@/lib/voice-agent/interviewer";
import { getResearchPlan, planToAgentContext } from "./plans-service";

/**
 * Orchestration for the research flow.
 *
 * createResearchInterview is analog to createAndInviteCheckin but WITHOUT an
 * email send. It loads the plan, builds the agent's input bucket (plan
 * context + optional brand context derived from the org), and creates the
 * interview_sessions row via createInterviewSession (which fires the opening
 * message itself). The mail layer + scheduled-slot flow live in the sibling
 * milestone — today we just produce a token so /interview/[token] is
 * reachable for a manual smoke test.
 *
 * The transcript-side handler (persistResearchTranscriptAndDiscovery) lives
 * in transcript-service.ts to break the import cycle with session-service.
 */

// ── createResearchInterview ────────────────────────────────────────────────

export type CreateResearchInterviewStatus =
  | "created"
  | "plan_not_found"
  | "error";

export interface CreateResearchInterviewResult {
  status: CreateResearchInterviewStatus;
  /** Public capability token for /interview/[token]. */
  accessToken: string | null;
  sessionId: string | null;
  message: string | null;
}

export async function createResearchInterview(params: {
  orgId: string;
  planId: string;
  /** Optional: link the session to a specific invite row (so the invite's
   *  status can later be progressed). When omitted, the session stands on
   *  its own — useful for one-off ad-hoc research links. */
  inviteId?: string | null;
  /** Override language; defaults to interviewer's DEFAULT_INTERVIEW_LANGUAGE. */
  language?: "de" | "en";
}): Promise<CreateResearchInterviewResult> {
  const base: CreateResearchInterviewResult = {
    status: "error",
    accessToken: null,
    sessionId: null,
    message: null,
  };

  const plan = await getResearchPlan(params.orgId, params.planId);
  if (!plan) {
    return {
      ...base,
      status: "plan_not_found",
      message: "Research plan not found in this organization.",
    };
  }

  try {
    // Brand context — best-effort. Org-name + product label give the agent
    // grounding ("when you set up new sales pipelines …") without naming
    // the product to the participant. Both lookups are .catch(() => null) so
    // missing settings don't break the session — the agent then frames itself
    // as independent research, exactly like the external path will.
    const [orgName, orgSettings] = await Promise.all([
      getOrgName(params.orgId).catch(() => null),
      getOrgSettings(params.orgId).catch(() => null),
    ]);
    const brand: ResearchBrand | null = orgName?.trim()
      ? {
          orgName: orgName.trim(),
          productName: orgSettings?.productName?.trim() || null,
        }
      : null;

    const input: ResearchInput = {
      plan: planToAgentContext(plan),
      brand,
    };

    const session: InterviewSession = await createInterviewSession({
      orgId: params.orgId,
      kind: "research",
      mode: "text",
      planId: plan.id,
      inviteId: params.inviteId ?? null,
      dealContext: input,
      language: params.language ?? "de",
    });

    return {
      status: "created",
      accessToken: session.accessToken,
      sessionId: session.id,
      message: null,
    };
  } catch (err) {
    console.error(
      `[createResearchInterview] failed for plan ${params.planId}:`,
      err instanceof Error ? err.message : err,
    );
    if (err instanceof Error && err.cause !== undefined) {
      console.error("[createResearchInterview] underlying cause:", err.cause);
    }
    return {
      ...base,
      status: "error",
      message: "Could not create the research interview.",
    };
  }
}

// persistResearchTranscriptAndDiscovery moved to ./transcript-service.ts to
// break the session-service ↔ research-orchestration import cycle. See that
// file's header comment.

import "server-only";

import { getDealById } from "@/lib/deals/service";
import { getLatestRiskScore } from "@/lib/risk/service";
import type {
  InterviewInput,
  InterviewLanguage,
} from "@/lib/voice-agent/interviewer";
import {
  createInterviewSession,
  getDealInterview,
  markInterviewInvited,
} from "@/lib/voice-agent/session-service";
import { sendEmail } from "@/lib/email/resend";
import { buildInterviewInvite, interviewUrl } from "@/lib/email/interview-invite";

/**
 * Shared "create the post-loss interview (if needed) AND email the invitation"
 * flow. Used by BOTH the manual invite route and the lost-deal auto-trigger, so
 * the two paths never diverge.
 *
 * Returns a result and NEVER throws for expected conditions (missing contact,
 * not found, already closed) — and catches unexpected infra errors internally
 * too — so the auto-trigger can call it without risking the outcome update.
 */

export type CreateAndInviteStatus =
  | "sent"
  | "missing_contact"
  | "not_found"
  | "not_open"
  | "error";

export interface CreateAndInviteResult {
  status: CreateAndInviteStatus;
  /** Whether a new interview session was created (vs. reusing an existing one). */
  created: boolean;
  sentTo: string | null;
  invitedAt: string | null;
  accessToken: string | null;
  message: string | null;
}

export async function createAndInviteInterview(
  orgId: string,
  dealId: string,
): Promise<CreateAndInviteResult> {
  const base: CreateAndInviteResult = {
    status: "error",
    created: false,
    sentTo: null,
    invitedAt: null,
    accessToken: null,
    message: null,
  };

  const deal = await getDealById(orgId, dealId);
  if (!deal) {
    return { ...base, status: "not_found", message: "Deal not found." };
  }

  const contactName = deal.contactName?.trim();
  const email = deal.contactEmail?.trim();
  if (!contactName || !email) {
    return {
      ...base,
      status: "missing_contact",
      message: "A contact name and email are required.",
    };
  }

  try {
    // Single buyer-facing language for this flow — drives BOTH the session
    // (agent output) and the invite email copy. DACH today; thread a per-deal
    // column through here when one is added.
    const language: InterviewLanguage = "de";

    // Idempotent: reuse the deal's existing interview, else create one.
    let accessToken: string;
    let status: "open" | "completed" | "abandoned";
    let created = false;

    const existing = await getDealInterview(orgId, dealId);
    if (existing) {
      accessToken = existing.accessToken;
      status = existing.status;
    } else {
      const risk = await getLatestRiskScore(orgId, dealId);
      const dealContext: InterviewInput = {
        deal: {
          dealName: deal.name,
          company: deal.companyName,
          contactName,
          amount: deal.amount,
          currency: deal.currency,
        },
        riskAnalysis: risk
          ? {
              riskScore: risk.risk_score,
              riskLevel: risk.risk_level,
              signals: risk.signals,
              overallReasoning: risk.overall_reasoning,
              recommendations: risk.recommendations,
            }
          : {
              riskScore: 0,
              riskLevel: "low",
              signals: [],
              overallReasoning: "No risk analysis on record for this deal.",
              recommendations: [],
            },
      };
      const session = await createInterviewSession({
        orgId,
        dealId,
        dealContext,
        language,
      });
      accessToken = session.accessToken;
      status = session.status;
      created = true;
    }

    if (status !== "open") {
      return {
        ...base,
        created,
        accessToken,
        status: "not_open",
        message: "This interview is no longer open.",
      };
    }

    const { subject, html, text } = buildInterviewInvite({
      contactName,
      company: deal.companyName,
      url: interviewUrl(accessToken),
      locale: language,
    });
    await sendEmail({ to: email, subject, html, text });
    const invitedAt = await markInterviewInvited(orgId, accessToken);

    return {
      status: "sent",
      created,
      sentTo: email,
      invitedAt,
      accessToken,
      message: null,
    };
  } catch (err) {
    // Surface the full cause chain (Opus / email / key-shadow live in err.cause).
    console.error(
      `[createAndInviteInterview] failed for deal ${dealId}:`,
      err instanceof Error ? err.message : err,
    );
    if (err instanceof Error && err.cause !== undefined) {
      console.error("[createAndInviteInterview] underlying cause:", err.cause);
    }
    return {
      ...base,
      status: "error",
      message: "Could not create or send the interview.",
    };
  }
}

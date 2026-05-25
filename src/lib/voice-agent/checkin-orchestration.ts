import "server-only";

import { getAccount, markAccountCheckedIn } from "@/lib/accounts/service";
import { getLatestHealthScore } from "@/lib/accounts/health-service";
import { getOrgName } from "@/lib/auth/org";
import { getOrgSettings } from "@/lib/settings/org-settings";
import type { CheckinInput } from "@/lib/voice-agent/interviewer";
import {
  createInterviewSession,
  getAccountCheckin,
  markInterviewInvited,
} from "@/lib/voice-agent/session-service";
import { sendEmail } from "@/lib/email/resend";
import { buildCheckinInvite, interviewUrl } from "@/lib/email/interview-invite";

/**
 * "Create the account check-in (if needed) AND email the invitation" flow — the
 * health-side mirror of createAndInviteInterview. The agent speaks in the Findr
 * customer's name (org name + product), and the email goes to the account's
 * sponsor. Recent churn signals are passed as private background for at most one
 * targeted follow-up. Never throws for expected conditions.
 */

export type CheckinInviteStatus =
  | "sent"
  | "missing_contact"
  | "not_found"
  | "error";

export interface CheckinInviteResult {
  status: CheckinInviteStatus;
  /** Whether a new check-in session was created (vs. reusing an open one). */
  created: boolean;
  sentTo: string | null;
  invitedAt: string | null;
  accessToken: string | null;
  message: string | null;
}

export async function createAndInviteCheckin(
  orgId: string,
  accountId: string,
): Promise<CheckinInviteResult> {
  const base: CheckinInviteResult = {
    status: "error",
    created: false,
    sentTo: null,
    invitedAt: null,
    accessToken: null,
    message: null,
  };

  const account = await getAccount(orgId, accountId);
  if (!account) {
    return { ...base, status: "not_found", message: "Account not found." };
  }

  const email = account.sponsorEmail?.trim();
  const sponsorName = account.sponsorName?.trim() || null;
  if (!email) {
    return {
      ...base,
      status: "missing_contact",
      message: "A sponsor email is required.",
    };
  }

  try {
    const [orgName, settings, health] = await Promise.all([
      getOrgName(orgId),
      getOrgSettings(orgId),
      getLatestHealthScore(orgId, accountId),
    ]);
    // Product label: the configured name, or a neutral fallback for the agent.
    // The email uses its own German fallback when no product is set.
    const productSetting = settings.productName?.trim() || null;
    const agentProduct = productSetting ?? "your subscription";
    const recentSignals = health?.signals.map((s) => s.type) ?? [];

    // Reuse an existing OPEN check-in (avoid duplicates on resend); otherwise
    // start a new one. A completed/abandoned check-in does NOT block a new one —
    // check-ins recur over time.
    const existing = await getAccountCheckin(orgId, accountId);
    let accessToken: string;
    let created = false;
    if (existing && existing.status === "open") {
      accessToken = existing.accessToken;
    } else {
      const context: CheckinInput = {
        account: {
          orgName,
          productName: agentProduct,
          companyName: account.companyName,
          sponsorName,
        },
        recentSignals,
      };
      const session = await createInterviewSession({
        orgId,
        accountId,
        kind: "checkin",
        dealContext: context,
        language: "de",
      });
      accessToken = session.accessToken;
      created = true;
    }

    const { subject, html, text } = buildCheckinInvite({
      contactName: sponsorName,
      orgName,
      productName: productSetting ?? "",
      url: interviewUrl(accessToken),
    });
    await sendEmail({ to: email, subject, html, text });
    const invitedAt = await markInterviewInvited(orgId, accessToken);
    // Stamp the account so the scheduler knows when the next check-in is due
    // (covers both this manual path and the daily cron).
    await markAccountCheckedIn(orgId, accountId);

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
      `[createAndInviteCheckin] failed for account ${accountId}:`,
      err instanceof Error ? err.message : err,
    );
    if (err instanceof Error && err.cause !== undefined) {
      console.error("[createAndInviteCheckin] underlying cause:", err.cause);
    }
    return {
      ...base,
      status: "error",
      message: "Could not create or send the check-in.",
    };
  }
}

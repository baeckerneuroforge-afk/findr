import { NextResponse, type NextRequest } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { getDealById } from "@/lib/deals/service";
import { getLatestRiskScore } from "@/lib/risk/service";
import {
  VoiceUnavailableError,
  type InterviewInput,
} from "@/lib/voice-agent/interviewer";
import {
  createInterviewSession,
  getDealInterview,
} from "@/lib/voice-agent/session-service";

/**
 * Start a post-loss interview for a LOST deal. Builds the interview context from
 * the real deal + its latest stored risk analysis, then creates one session
 * (idempotent — one interview per deal). NO sending here: the response carries
 * the access token; the dashboard shows the link to copy/test. Email/SMS lands
 * in the next sprint.
 *
 * The opening question is an Opus call (~40-60s); the interviewer already wraps
 * it with a 120s per-request timeout (see interviewer.ts).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;
  const { id } = await params;

  const deal = await getDealById(orgId, id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }
  if (deal.outcome !== "lost") {
    return NextResponse.json(
      { error: "Mark the deal as lost before starting a post-loss interview." },
      { status: 400 },
    );
  }
  const contactName = deal.contactName?.trim();
  if (!contactName) {
    return NextResponse.json(
      { error: "Add contact details (at least a name) before starting an interview." },
      { status: 400 },
    );
  }

  // One interview per deal. If one already exists, return it instead of creating
  // a second.
  const existing = await getDealInterview(orgId, id);
  if (existing) {
    return NextResponse.json({ session: existing, existing: true });
  }

  // Use the real stored risk analysis as the prediction the interview checks
  // against. If none is on record, fall back to a neutral prediction so the
  // interview can still run.
  const risk = await getLatestRiskScore(orgId, id);
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

  try {
    const session = await createInterviewSession({
      orgId,
      dealId: id,
      dealContext,
      // DACH default for now; a per-deal language picker can come later.
      language: "de",
    });
    return NextResponse.json({
      session: {
        accessToken: session.accessToken,
        status: session.status,
        createdAt: session.createdAt,
        completedAt: session.completedAt,
      },
      existing: false,
    });
  } catch (err) {
    // Surface the full cause chain (key-shadow / timeout / overload live in
    // err.cause), mirroring the solution-layer route.
    console.error(
      `[deals/${id}/interview] create failed:`,
      err instanceof Error ? err.message : err,
    );
    if (err instanceof Error && err.cause !== undefined) {
      console.error(`[deals/${id}/interview] underlying cause:`, err.cause);
    }
    if (err instanceof VoiceUnavailableError) {
      return NextResponse.json(
        {
          error:
            "The interview assistant is unavailable right now. Please try again in a moment.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "Could not start the interview. Please try again." },
      { status: 500 },
    );
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  AnalyzeTranscriptSchema,
  analyzeAccountTranscript,
} from "@/lib/accounts/health-service";

/**
 * Analyze a pasted post-sale transcript for account health. Stores the
 * transcript as a call on the account, runs the existing risk engine over all of
 * the account's transcripts, and persists the inverted health score.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const { id } = await params;
  const rawBody = await request.json().catch(() => null);
  const parsed = AnalyzeTranscriptSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await analyzeAccountTranscript(
      orgOrError.orgId,
      id,
      parsed.data.transcript,
    );
    if (!result) {
      return NextResponse.json({ error: t("notFound.account") }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      health: result.health,
      source: result.source,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : t("unexpected") },
      { status: 500 },
    );
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  SavePlayUnavailableError,
  generateSavePlay,
} from "@/lib/accounts/save-play-service";

/**
 * Generate customer-retention recommendations (save-play) for an account from
 * its latest health analysis. Mirrors POST /api/solution/generate.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const { id } = await params;

  try {
    const report = await generateSavePlay(orgOrError.orgId, id);
    if (!report) {
      return NextResponse.json(
        {
          error:
            "Account not found, or no health score exists yet. Analyze a transcript first.",
        },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, report });
  } catch (err) {
    // Surface the FULL error (incl. cause chain) server-side; the wrapper message
    // hides the real reason (it lives in err.cause).
    console.error(
      `[accounts/save-play] generation failed for account ${id}:`,
      err,
    );
    if (err instanceof Error && err.cause !== undefined) {
      console.error("[accounts/save-play] underlying cause:", err.cause);
    }
    if (err instanceof SavePlayUnavailableError) {
      return NextResponse.json(
        { error: "Save-play generation failed", detail: err.message },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Save-play generation failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}

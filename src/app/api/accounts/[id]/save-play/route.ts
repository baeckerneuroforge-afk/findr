import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const { id } = await params;

  try {
    const report = await generateSavePlay(orgOrError.orgId, id);
    if (!report) {
      return NextResponse.json(
        {
          error:
            t("accounts.noHealthScore"),
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
        { error: t("accounts.savePlayFailed") },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: t("accounts.savePlayFailed"),
      },
      { status: 500 },
    );
  }
}

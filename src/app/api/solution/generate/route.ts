import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { SolutionUnavailableError } from "@/lib/solution/extractor";
import { generateAndPersistSolution } from "@/lib/solution/service";

const GenerateSolutionSchema = z.object({
  dealId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const body = await req.json().catch(() => null);
  const parsed = GenerateSolutionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const report = await generateAndPersistSolution(
      orgOrError.orgId,
      parsed.data.dealId,
    );
    if (!report) {
      return NextResponse.json(
        {
          error:
            t("solution.noRiskAnalysis"),
        },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, report });
  } catch (err) {
    // Surface the FULL error (including the cause chain) server-side. The
    // wrapper message ("Claude solution generation failed") hides the real
    // reason — the underlying error lives in err.cause.
    console.error(
      `[solution/generate] generation failed for deal ${parsed.data.dealId}:`,
      err,
    );
    if (err instanceof Error && err.cause !== undefined) {
      console.error("[solution/generate] underlying cause:", err.cause);
    }
    if (err instanceof SolutionUnavailableError) {
      return NextResponse.json(
        { error: t("solution.generationFailed"), detail: err.message },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: t("solution.generationFailed"),
      },
      { status: 500 },
    );
  }
}

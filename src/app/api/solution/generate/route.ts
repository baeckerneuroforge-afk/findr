import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { SolutionUnavailableError } from "@/lib/solution/extractor";
import { generateAndPersistSolution } from "@/lib/solution/service";

const GenerateSolutionSchema = z.object({
  dealId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const body = await req.json().catch(() => null);
  const parsed = GenerateSolutionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
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
            "Deal not found, or no risk analysis exists yet. Run a risk analysis first.",
        },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, report });
  } catch (err) {
    if (err instanceof SolutionUnavailableError) {
      return NextResponse.json(
        { error: "Solution generation failed", detail: err.message },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Solution generation failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}

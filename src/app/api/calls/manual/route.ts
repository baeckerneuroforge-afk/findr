import { NextResponse, type NextRequest } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  createManualCall,
  ManualCallSchema,
  ManualImportError,
} from "@/lib/manual-import/service";

export async function POST(request: NextRequest) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const rawBody = await request.json().catch(() => null);
  const parsed = ManualCallSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const call = await createManualCall(orgOrError.orgId, parsed.data);
    return NextResponse.json({ success: true, callId: call.id });
  } catch (err) {
    if (err instanceof ManualImportError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create call" },
      { status: 500 },
    );
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  createManualCall,
  ManualCallSchema,
  ManualImportError,
} from "@/lib/manual-import/service";

export async function POST(request: NextRequest) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const rawBody = await request.json().catch(() => null);
  const parsed = ManualCallSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const call = await createManualCall(orgOrError.orgId, parsed.data);
    return NextResponse.json({ success: true, callId: call.id });
  } catch (err) {
    if (err instanceof ManualImportError) {
      // ManualImportError carries a stable HTTP status; map it to a localized
      // message (404 = referenced deal missing). The raw err.message is a
      // DB/technical string, so it stays out of the user-facing payload.
      return NextResponse.json(
        { error: err.status === 404 ? t("notFound.deal") : t("unexpected") },
        { status: err.status },
      );
    }

    console.error("[calls/manual] failed:", err);
    return NextResponse.json({ error: t("unexpected") }, { status: 500 });
  }
}

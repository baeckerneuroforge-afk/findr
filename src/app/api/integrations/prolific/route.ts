import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  disconnectProlificCredential,
  revalidateProlificCredential,
  saveProlificCredential,
} from "@/lib/panel/service";

const TokenSchema = z.object({
  apiToken: z.string().trim().min(10).max(2_000),
});

function errorStatus(reason: "invalid" | "unavailable" | "missing_token") {
  if (reason === "invalid") return 400;
  if (reason === "missing_token") return 404;
  return 502;
}

export async function POST(req: NextRequest) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const body = await req.json().catch(() => null);
  const parsed = TokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: t("invalidRequestBody") },
      { status: 400 },
    );
  }

  try {
    const result = await saveProlificCredential(
      orgOrError.orgId,
      parsed.data.apiToken,
    );
    if (!result.ok) {
      return NextResponse.json(
        { success: false, status: result.reason },
        { status: errorStatus(result.reason) },
      );
    }
    return NextResponse.json({ success: true, credential: result.summary });
  } catch (err) {
    console.error("[integrations/prolific] save failed:", err);
    return NextResponse.json(
      { success: false, error: t("unexpected") },
      { status: 500 },
    );
  }
}

export async function PUT() {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const result = await revalidateProlificCredential(orgOrError.orgId);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, status: result.reason },
      { status: errorStatus(result.reason) },
    );
  }
  return NextResponse.json({ success: true, credential: result.summary });
}

export async function DELETE() {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  try {
    await disconnectProlificCredential(orgOrError.orgId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[integrations/prolific] disconnect failed:", err);
    return NextResponse.json(
      { success: false, error: t("unexpected") },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireSettingsAdminOrError } from "@/lib/settings/server-auth";
import { buildDataExport } from "@/lib/settings/export";

export async function GET() {
  const t = await getTranslations("errors");
  const admin = await requireSettingsAdminOrError();
  if ("error" in admin) return admin.error;

  try {
    const payload = await buildDataExport(admin.orgId);
    const filename = `klymeo-export-${admin.orgId}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[settings/export] failed:", err);
    return NextResponse.json(
      { success: false, error: t("unexpected") },
      { status: 500 },
    );
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireSettingsAdminOrError } from "@/lib/settings/server-auth";
import { setInterviewRetentionDays } from "@/lib/settings/org-settings";

/**
 * PUT /api/settings/retention — DSGVO G5. Set the org's interview-data
 * retention period. `retentionDays: null` turns auto-deletion OFF; a positive
 * integer makes the daily retention cron delete interview_sessions older than
 * that many days. Admin-gated (mirrors export / delete-org).
 */
const RetentionSchema = z.object({
  // null = off; else 1 day .. ~10 years (upper bound keeps the value sane and
  // matches the DB CHECK's lower bound).
  retentionDays: z.union([z.number().int().min(1).max(3650), z.null()]),
});

export async function PUT(req: NextRequest) {
  const t = await getTranslations("errors");
  const admin = await requireSettingsAdminOrError();
  if ("error" in admin) return admin.error;

  const raw = await req.json().catch(() => null);
  const parsed = RetentionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: t("settings.invalidSettings") },
      { status: 400 },
    );
  }

  try {
    await setInterviewRetentionDays(admin.orgId, parsed.data.retentionDays);
    return NextResponse.json({
      success: true,
      retentionDays: parsed.data.retentionDays,
    });
  } catch (err) {
    console.error(
      "[settings/retention] save failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: t("settings.couldNotSave") },
      { status: 500 },
    );
  }
}

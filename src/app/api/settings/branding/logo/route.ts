import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireSettingsAdminOrError } from "@/lib/settings/server-auth";
import { setOrgLogoUrl } from "@/lib/settings/org-settings";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/** Upload / remove the white-label logo. The storage object lives in the
 * `org-branding` bucket; setOrgLogoUrl owns the logo_url column. */

const BUCKET = "org-branding";
const MAX_BYTES = 1_048_576; // 1 MB
// Raster-only by design: a public-bucket SVG would be served inline and could
// carry active content (<script>/onload). Matches the export side, which also
// refuses SVG (branding-assets.ts). Logos render fine as png/jpg/webp.
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  const t = await getTranslations("errors");
  const adminOrError = await requireSettingsAdminOrError();
  if ("error" in adminOrError) return adminOrError.error;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { error: t("settings.invalidSettings") },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: t("settings.invalidSettings") },
      { status: 400 },
    );
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: t("settings.invalidSettings") },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminSupabaseClient();
    // Unique timestamped path → replacing the logo never serves a stale CDN copy.
    const path = `${adminOrError.orgId}/${Date.now()}-logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true });
    if (uploadError) throw uploadError;

    const logoUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data
      .publicUrl;

    await setOrgLogoUrl(adminOrError.orgId, logoUrl);
    return NextResponse.json({ success: true, logoUrl });
  } catch (err) {
    console.error(
      "[settings/branding/logo] upload failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("settings.couldNotSave") },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const t = await getTranslations("errors");
  const adminOrError = await requireSettingsAdminOrError();
  if ("error" in adminOrError) return adminOrError.error;

  try {
    // v1: clear the reference; leaving the old object in the bucket is fine.
    await setOrgLogoUrl(adminOrError.orgId, null);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(
      "[settings/branding/logo] remove failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("settings.couldNotSave") },
      { status: 500 },
    );
  }
}

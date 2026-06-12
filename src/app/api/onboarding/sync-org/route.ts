import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { seedDemoData } from "@/lib/seed/demo-data";

const SyncOrgSchema = z.object({
  clerk_org_id: z.string().min(1),
  name: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const t = await getTranslations("errors");
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    const parsed = SyncOrgSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: t("invalidRequest"), details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { clerk_org_id, name } = parsed.data;

    // Authorize the tenant: a caller may only sync the org that is active in
    // their verified Clerk session. Without this, any signed-in user could
    // upsert an arbitrary clerk_org_id from the request body — overwriting
    // another org's name (which feeds branding/PDF/email) or pre-seeding org
    // rows with demo data. Both legitimate callers (onboarding: setActive →
    // sync; settings: organization.update → sync) target the active org, so
    // this never rejects a real flow.
    if (!orgId || orgId !== clerk_org_id) {
      return NextResponse.json({ error: t("unauthorized") }, { status: 403 });
    }

    const supabase = createAdminSupabaseClient();

    const { data, error } = await supabase
      .from("organizations")
      .upsert(
        {
          clerk_org_id,
          name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "clerk_org_id" },
      )
      .select()
      .single();

    if (error) {
      console.error("[onboarding/sync-org] org upsert failed:", error.message);
      return NextResponse.json(
        { error: t("unexpected") },
        { status: 500 },
      );
    }

    const org = data as { id: string };
    const { count: dealCount } = await supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .eq("org_id", org.id);

    if (dealCount === 0) {
      after(async () => {
        try {
          await seedDemoData(org.id);
        } catch (seedError) {
          console.error("Demo seed failed:", seedError);
        }
      });
    }

    return NextResponse.json({ success: true, org: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : t("unexpected") },
      { status: 500 },
    );
  }
}

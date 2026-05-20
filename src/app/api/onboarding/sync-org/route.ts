import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const SyncOrgSchema = z.object({
  clerk_org_id: z.string().min(1),
  name: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    const parsed = SyncOrgSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { clerk_org_id, name } = parsed.data;
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, org: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

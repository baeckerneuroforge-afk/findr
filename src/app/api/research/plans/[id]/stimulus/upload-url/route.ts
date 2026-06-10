import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/research/plans/[id]/stimulus/upload-url — mintet eine einmalige
 * Signed-Upload-URL für einen VIDEO-Stimulus (Etappe 3).
 *
 * Warum nicht durch die Stimulus-Route wie Bilder: Vercel-Functions kappen
 * Request-Bodies bei 4,5 MB — ein Video (bis 100 MB) kann die Route nie
 * passieren. Der Client lädt deshalb DIREKT in den Bucket (PUT auf die
 * signedUrl) und meldet danach nur den storagePath an die Stimulus-Route.
 *
 * AUTH-MODELL (identisch zur Stimulus-Route): Clerk-Org via
 * requireOrgIdOrError + Plan-Ownership via getResearchPlan(orgId, planId).
 * Erst NACH beiden Gates wird die URL gemintet — und zwar ausschließlich für
 * einen Pfad im eigenen Namespace `${orgId}/${planId}/…`. Die URL erlaubt
 * genau EINEN Objekt-Write auf genau DIESEN Pfad (Token im Query-String,
 * kurzlebig, kein upsert); MIME (video/mp4) und Größe (100 MB) erzwingt der
 * Bucket selbst (Migration 20260703000008). Die Stimulus-Route verifiziert
 * den Pfad-Präfix beim Übernehmen erneut — eine fremde/erratene URL kann
 * also weder fremde Objekte überschreiben noch fremde Pläne bestücken.
 */

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const BUCKET = "research-stimuli";

const BodySchema = z.object({
  contentType: z.literal("video/mp4"),
  sizeBytes: z.number().int().min(1).max(MAX_VIDEO_BYTES),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), code: "invalid_upload_request" },
      { status: 400 },
    );
  }

  try {
    // Gleiches Pfad-Schema wie der Bild-Upload — die Stimulus-Route prüft
    // beim Übernehmen exakt diesen `${orgId}/${planId}/`-Präfix.
    const path = `${orgId}/${planId}/${Date.now()}-stimulus.mp4`;
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      throw error ?? new Error("createSignedUploadUrl returned no data");
    }

    return NextResponse.json({
      path: data.path,
      token: data.token,
      signed_url: data.signedUrl,
    });
  } catch (err) {
    console.error(
      `[POST /api/research/plans/${planId}/stimulus/upload-url] failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("research.couldNotUpdatePlan") },
      { status: 500 },
    );
  }
}

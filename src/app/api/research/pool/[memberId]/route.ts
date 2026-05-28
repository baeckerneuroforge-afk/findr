import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { deletePoolMember, updatePoolMember } from "@/lib/research/participant-pool";

/**
 * PATCH / DELETE /api/research/pool/[memberId] — Pool-Eintrag bearbeiten /
 * löschen. Org-scoped über updatePoolMember/deletePoolMember (der orgId-Filter
 * ist die Vertrauensgrenze). 404-statt-403 für fremde IDs, damit Existenz
 * nicht geleakt wird — gleiche Posture wie die /participants-Route.
 *
 * PATCH ist ein Partial-Update: nur explizit gesetzte Felder werden
 * geschrieben (absent ≠ leeren). `null`/"" leert ein Feld; bei contactLabel
 * (NOT NULL) ist nur ein nicht-leerer String zulässig.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PatchSchema = z
  .object({
    contactLabel: z.string().trim().min(1).max(200).optional(),
    contactEmail: z
      .string()
      .trim()
      .max(320)
      .nullable()
      .optional()
      .refine(
        (v) => v === null || v === undefined || v === "" || EMAIL_RE.test(v),
        { message: "Invalid email" },
      )
      .transform((v) => (v === "" ? null : v)),
    role: z
      .string()
      .trim()
      .max(80)
      .nullable()
      .optional()
      .transform((v) => (v === "" ? null : v)),
    segment: z
      .string()
      .trim()
      .max(80)
      .nullable()
      .optional()
      .transform((v) => (v === "" ? null : v)),
    tags: z
      .array(z.string().trim().min(1).max(40))
      .max(30)
      .optional()
      .transform((arr) => (arr ? [...new Set(arr)] : undefined)),
    notes: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .transform((v) => (v === "" ? null : v)),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "At least one field must be provided",
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { memberId } = await params;

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await updatePoolMember(orgId, memberId, parsed.data);
  switch (result.status) {
    case "updated":
      return NextResponse.json({ success: true, member: result.member });
    case "not_found":
      return NextResponse.json({ error: "Pool-Eintrag nicht gefunden" }, { status: 404 });
    case "duplicate_email":
      return NextResponse.json(
        { error: "Diese E-Mail ist bereits einem anderen Pool-Eintrag zugeordnet." },
        { status: 409 },
      );
    default:
      return NextResponse.json(
        { error: result.message ?? "Pool-Eintrag konnte nicht aktualisiert werden." },
        { status: 500 },
      );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { memberId } = await params;

  const deleted = await deletePoolMember(orgId, memberId);
  if (!deleted) {
    return NextResponse.json({ error: "Pool-Eintrag nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ success: true, memberId });
}

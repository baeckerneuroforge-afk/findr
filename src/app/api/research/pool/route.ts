import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { createPoolMember } from "@/lib/research/participant-pool";

/**
 * POST /api/research/pool — neuen Pool-Eintrag anlegen.
 *
 * Reads laufen NICHT über diese Route: die Pool-Seite + die Invite-Surface
 * sind Server-Components und lesen den Pool direkt via listPoolMembers. Diese
 * Route deckt nur die Mutation ab (Client-Form → POST → router.refresh).
 *
 * Dedup (Email case-insensitive unique pro Org) ist ein DB-Index; eine
 * Kollision kommt als status="duplicate_email" zurück und wird hier auf 409
 * gemappt — dieselbe 409-Posture wie die PATCH-/participants-Route.
 */

const PoolMemberSchema = z.object({
  contactLabel: z.string().trim().min(1).max(200),
  contactEmail: z
    .string()
    .trim()
    .email()
    .max(320)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  role: z
    .string()
    .trim()
    .max(80)
    .nullable()
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  segment: z
    .string()
    .trim()
    .max(80)
    .nullable()
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(30)
    .optional()
    .transform((arr) => (arr ? [...new Set(arr)] : [])),
  notes: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
});

export async function POST(req: NextRequest) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: t("invalidRequestBody") }, { status: 400 });
  }

  const parsed = PoolMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await createPoolMember(orgId, parsed.data);
  switch (result.status) {
    case "created":
      return NextResponse.json({ success: true, member: result.member });
    case "duplicate_email":
      return NextResponse.json(
        { error: t("pool.emailExists") },
        { status: 409 },
      );
    default:
      return NextResponse.json(
        { error: result.message ?? t("pool.couldNotCreate") },
        { status: 500 },
      );
  }
}

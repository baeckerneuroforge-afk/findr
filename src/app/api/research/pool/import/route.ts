import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  importPoolMembers,
  type ImportPoolMemberResult,
} from "@/lib/research/participant-pool";
import { PoolMemberSchema } from "@/lib/schemas/participant-pool";

/**
 * POST /api/research/pool/import — CSV-Import in den Teilnehmer-Pool.
 *
 * Spiegelt den Bulk-Pfad von POST /api/research/plans/[id]/invites: der
 * Client parst die CSV (lib/csv/parse.ts), zeigt die Vorschau und POSTet
 * dann ein bereits strukturiertes Array — kein Datei-Upload, kein Storage.
 *
 *   Body     → { members: [{ contactLabel, contactEmail?, role?, segment?,
 *                            tags?, notes? }, ...] }   (1–200 Einträge)
 *   Response → { success, results: [{ contactLabel, contactEmail, status,
 *                            member?, message? }], summary }
 *
 * Wire-Status wie die Bulk-Invite-Route: created | skipped_duplicate |
 * invalid | error ("invalid" ist reserviert — Zod lehnt heute den ganzen
 * Batch ab, der Client-Parser filtert vorab). Die Service-Statusse
 * duplicate_in_file / duplicate_in_pool werden hier auf skipped_duplicate
 * gemappt und an der Boundary lokalisiert (Muster der invite-from-pool-
 * Route). Cap 200/Request wie bei Invites (Fluid-Compute-Budget) — darüber
 * 413, der Client soll splitten.
 */

const ImportBodySchema = z.object({
  members: z.array(PoolMemberSchema).min(1).max(200),
});

type ImportWireStatus = "created" | "skipped_duplicate" | "invalid" | "error";

type ImportWireItem = {
  contactLabel: string;
  contactEmail: string | null;
  status: ImportWireStatus;
  member?: ImportPoolMemberResult["member"];
  message?: string;
};

export async function POST(req: NextRequest) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: t("invalidRequestBody") }, { status: 400 });
  }

  const parsed = ImportBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("pool.invalidImportBody"), details: parsed.error.flatten() },
      { status: parsed.error.issues.some((i) => i.code === "too_big") ? 413 : 400 },
    );
  }

  const { results, summary } = await importPoolMembers(orgId, parsed.data.members);

  const wireResults: ImportWireItem[] = results.map((r) => {
    switch (r.status) {
      case "created":
        return {
          contactLabel: r.contactLabel,
          contactEmail: r.contactEmail,
          status: "created",
          member: r.member,
        };
      case "duplicate_in_file":
        return {
          contactLabel: r.contactLabel,
          contactEmail: r.contactEmail,
          status: "skipped_duplicate",
          message: t("pool.emailDuplicateInFile"),
        };
      case "duplicate_in_pool":
        return {
          contactLabel: r.contactLabel,
          contactEmail: r.contactEmail,
          status: "skipped_duplicate",
          message: t("pool.emailExists"),
        };
      default:
        return {
          contactLabel: r.contactLabel,
          contactEmail: r.contactEmail,
          status: "error",
          message: t("pool.couldNotCreate"),
        };
    }
  });

  return NextResponse.json({ success: true, results: wireResults, summary });
}

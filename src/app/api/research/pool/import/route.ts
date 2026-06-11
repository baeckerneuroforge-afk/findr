import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  MAX_POOL_EMAIL_LENGTH,
  MAX_POOL_IMPORT_ROWS,
  MAX_POOL_LABEL_LENGTH,
} from "@/lib/csv/parse";
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
 * Validierung zweistufig: der ENVELOPE (members als Array, 1–200) wird als
 * Ganzes geprüft — too_big kann dort nur noch das Zeilen-Cap sein ⇒ 413,
 * der Client soll splitten. Jede ZEILE läuft danach einzeln durch
 * PoolMemberSchema; ungültige Zeilen werden als status "invalid" gemeldet,
 * statt den ganzen Batch zu reißen — Sicherheitsnetz für API-Nutzer und
 * Client/Schema-Drift (eine schiefe Zeile darf nie 199 gültige blockieren).
 * Die Service-Statusse duplicate_in_file / duplicate_in_pool werden auf
 * skipped_duplicate gemappt und an der Boundary lokalisiert (Muster der
 * invite-from-pool-Route).
 */

const ImportBodySchema = z.object({
  members: z.array(z.unknown()).min(1).max(MAX_POOL_IMPORT_ROWS),
});

type MemberInput = z.infer<typeof PoolMemberSchema>;

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

  // Zeilenweise validieren: ungültige Zeilen sofort als "invalid" auf ihre
  // Eingabe-Position legen, gültige gesammelt an den Service geben und die
  // Service-Ergebnisse danach indexgenau zurückstitchen — die Antwort bleibt
  // in Eingabe-Reihenfolge.
  const rawMembers = parsed.data.members;
  const wireResults: ImportWireItem[] = new Array(rawMembers.length);
  const validInputs: MemberInput[] = [];
  const validIndexes: number[] = [];

  rawMembers.forEach((raw, idx) => {
    const row = PoolMemberSchema.safeParse(raw);
    if (row.success) {
      validInputs.push(row.data);
      validIndexes.push(idx);
      return;
    }
    // Best-effort-Echo von Label/E-Mail, damit der Nutzer die Zeile in der
    // Ergebnisliste wiederfindet (gekappt auf die Feld-Limits).
    const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    wireResults[idx] = {
      contactLabel:
        typeof obj.contactLabel === "string"
          ? obj.contactLabel.slice(0, MAX_POOL_LABEL_LENGTH)
          : "",
      contactEmail:
        typeof obj.contactEmail === "string"
          ? obj.contactEmail.slice(0, MAX_POOL_EMAIL_LENGTH)
          : null,
      status: "invalid",
      message: t("pool.rowInvalid", {
        field: row.error.issues[0]?.path.map(String).join(".") || "?",
      }),
    };
  });

  const { results, summary } = await importPoolMembers(orgId, validInputs);

  results.forEach((r, k) => {
    const idx = validIndexes[k];
    switch (r.status) {
      case "created":
        wireResults[idx] = {
          contactLabel: r.contactLabel,
          contactEmail: r.contactEmail,
          status: "created",
          member: r.member,
        };
        break;
      case "duplicate_in_file":
        wireResults[idx] = {
          contactLabel: r.contactLabel,
          contactEmail: r.contactEmail,
          status: "skipped_duplicate",
          message: t("pool.emailDuplicateInFile"),
        };
        break;
      case "duplicate_in_pool":
        wireResults[idx] = {
          contactLabel: r.contactLabel,
          contactEmail: r.contactEmail,
          status: "skipped_duplicate",
          message: t("pool.emailExists"),
        };
        break;
      default:
        wireResults[idx] = {
          contactLabel: r.contactLabel,
          contactEmail: r.contactEmail,
          status: "error",
          message: t("pool.couldNotCreate"),
        };
        break;
    }
  });

  const invalidCount = rawMembers.length - validInputs.length;

  return NextResponse.json({
    success: true,
    results: wireResults,
    summary: {
      created: summary.created,
      skipped: summary.skipped,
      errors: summary.errors + invalidCount,
      total: rawMembers.length,
    },
  });
}

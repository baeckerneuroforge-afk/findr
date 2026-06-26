import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { logDecision } from "@/lib/konsoul/agent/action-audit";

/**
 * POST /api/konsoul-agent/decision — Konsoul P3 Audit-Schreibung #2.
 *
 * Setzt GENAU die mit `auditId` identifizierte `proposed`-Zeile in
 * `konsoul_action_log` auf den Ausgang (`accepted` = Confirm ausgeführt /
 * `ignored` = verworfen). Die Aktion SELBST läuft NICHT hier — sie ist bereits
 * über den Confirm-Klick gegen die bestehende org-scoped Ziel-Route gelaufen;
 * diese dünne Route protokolliert nur den Ausgang.
 *
 * SICHERHEIT:
 *  - orgId ist SERVER-AUTORITATIV (requireOrgIdOrError aus der Session) — der
 *    Body trägt sie NIE. logDecision scoped den Update zusätzlich per
 *    `.eq("org_id", orgId)`, sodass eine fremde auditId (anderer Org) nichts
 *    trifft (Cross-Org-Schutz: 0 betroffene Zeilen).
 *  - Body trägt NUR { auditId (UUID), status } — kein Freitext, keine PII.
 *  - FAIL-OPEN: logDecision wirft nie und kippt nichts; ein Audit-Fehler darf den
 *    bereits erfolgten Confirm nicht nachträglich entwerten. Diese Route gibt bei
 *    gültigem Body immer 200 zurück (das Audit ist best-effort).
 */

const BodySchema = z.object({
  /** Die vom Proposal-Envelope mitgereichte Audit-Zeilen-ID. */
  auditId: z.string().min(1).max(200),
  status: z.enum(["accepted", "ignored"]),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: t("invalidJsonBody") }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Org-scoped, fail-open: logDecision loggt Fehler intern und wirft nie.
  await logDecision({
    auditId: parsed.data.auditId,
    orgId,
    status: parsed.data.status,
  });

  return NextResponse.json({ success: true });
}

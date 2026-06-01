import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import {
  createOpenLink,
  setOpenLinkStatus,
  updateOpenLinkSettings,
  type ResearchOpenLinkRecord,
} from "@/lib/research/open-links";

/**
 * Token-freie Sicht für die Researcher-Response. Der access_token verlässt den
 * Server NIE im API-Response-Body — das öffentliche Capability-Credential ist
 * ausschließlich im shareable URL sichtbar (server-seitig in page.tsx via
 * researchOpenLinkUrl gebaut). Das Panel verwendet ohnehin nur { success,
 * error } und liest danach via router.refresh die Server-Component neu.
 */
function toResearcherView(link: ResearchOpenLinkRecord) {
  return {
    id: link.id,
    status: link.status,
    maxSessions: link.max_sessions,
    validUntil: link.valid_until,
    label: link.label,
  };
}

/**
 * POST /api/research/plans/[id]/open-link — Researcher-seitige Verwaltung des
 * EINEN offenen Studien-Links (Phase 4, Baustein 2, Etappe 2). Spiegelt
 * quotas/route.ts + screening-questions/route.ts: requireOrgIdOrError +
 * getResearchPlan (orgId ist die Trust-Boundary), Zod-validierter Body.
 *
 * ── MANDANTENTRENNUNG ────────────────────────────────────────────────────────
 * org_id + plan_id kommen NIE aus dem Body. org_id stammt aus der Clerk-Session
 * (requireOrgIdOrError), plan_id aus der URL und wird gegen
 * getResearchPlan(orgId, planId) geprüft (404 sonst — der Caller kann keinen
 * fremden Plan adressieren). Der Body trägt AUSSCHLIESSLICH die erlaubten
 * Verwaltungsfelder — KEIN org_id/plan_id/link_id. Die Service-Schicht bindet
 * die org_id der Zeile zusätzlich an getResearchPlan (Defense-in-Depth).
 *
 * Drei Aktionen (discriminated union über `action`):
 *   create     → aktiven Link münzen (Token server-seitig; idempotent)
 *   set_status → active ↔ disabled (Kill-Switch / Widerruf)
 *   update     → max_sessions / valid_until / label setzen
 *
 * KEIN hartes Screening-Gate hier — die UI-Leitplanke (Hinweis + verborgener
 * Erzeugen-Button bei fehlendem Screening) sitzt im OpenLinkPanel; das harte
 * Erzwingen ("offene Links setzen Screening voraus") kommt mit der
 * Verdrahtung (E4). E2 ist rein additiv und ändert den Eintritts-Pfad nicht.
 */

const MAX_SESSIONS = z.number().int().min(1).max(1_000_000);
// Akzeptiert YYYY-MM-DD (HTML date-Input) oder vollen ISO-Timestamp; null = kein
// Ablauf. valid_until wird in E2 nur gespeichert/angezeigt, NICHT enforced.
const VALID_UNTIL = z
  .string()
  .trim()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "invalid date" });
const LABEL = z.string().trim().max(120);

const CreateSchema = z.object({
  action: z.literal("create"),
  maxSessions: MAX_SESSIONS.nullable().optional(),
  validUntil: VALID_UNTIL.nullable().optional(),
  label: LABEL.nullable().optional(),
});
const UpdateSchema = z.object({
  action: z.literal("update"),
  maxSessions: MAX_SESSIONS.nullable().optional(),
  validUntil: VALID_UNTIL.nullable().optional(),
  label: LABEL.nullable().optional(),
});
const StatusSchema = z.object({
  action: z.literal("set_status"),
  status: z.enum(["active", "disabled"]),
});
const BodySchema = z.discriminatedUnion("action", [
  CreateSchema,
  UpdateSchema,
  StatusSchema,
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;

  // Ownership + Trust-Boundary: nur ein Plan dieser org darf adressiert werden.
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: t("invalidRequestBody") }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (data.action === "create") {
    try {
      const link = await createOpenLink(orgId, planId, {
        maxSessions: data.maxSessions,
        validUntil: data.validUntil,
        label: data.label,
      });
      return NextResponse.json({ success: true, openLink: toResearcherView(link) });
    } catch {
      return NextResponse.json(
        { error: t("research.openLinkCreateFailed") },
        { status: 500 },
      );
    }
  }

  if (data.action === "set_status") {
    const link = await setOpenLinkStatus(orgId, planId, data.status);
    if (!link) {
      return NextResponse.json(
        { error: t("research.openLinkStatusFailed") },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, openLink: toResearcherView(link) });
  }

  // action === "update"
  const link = await updateOpenLinkSettings(orgId, planId, {
    maxSessions: data.maxSessions,
    validUntil: data.validUntil,
    label: data.label,
  });
  if (!link) {
    return NextResponse.json(
      { error: t("research.openLinkUpdateFailed") },
      { status: 500 },
    );
  }
  return NextResponse.json({ success: true, openLink: toResearcherView(link) });
}

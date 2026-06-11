import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  estimateProlificStudyCost,
  ProlificEstimateError,
} from "@/lib/panel/service";
import { ProlificApiError } from "@/lib/panel/prolific";

/**
 * POST /api/research/plans/[id]/panel/cost-estimate — Kostenvorschau (E6)
 * für die Prolific-Draft-Anlage. Reicht reward × places an Prolifics
 * Kalkulator durch (Fees/VAT kommen aus den Account-Einstellungen, nichts
 * ist hier hartkodiert) und liefert die Gesamtkosten in Cents zurück.
 *
 * Der Kalkulator ist plan-unabhängig; der Pfad bleibt trotzdem unter dem
 * Plan-Panel (Familie prolific-draft/sync/cost-estimate, dieselbe
 * Org-Auth). Feld-Grenzen spiegeln die prolific-draft-Route.
 */

const BodySchema = z.object({
  rewardCents: z.number().int().min(1).max(10_000_000),
  totalAvailablePlaces: z.number().int().min(1).max(1_000_000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: t("invalidRequestBody"),
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  // params nur konsumieren (Next-Konvention); die Schätzung selbst braucht
  // den Plan nicht.
  await params;

  try {
    const totalCostCents = await estimateProlificStudyCost(
      orgOrError.orgId,
      parsed.data,
    );
    return NextResponse.json({ success: true, totalCostCents });
  } catch (err) {
    if (err instanceof ProlificEstimateError) {
      return NextResponse.json(
        { success: false, error: err.code },
        { status: err.code === "missing_credentials" ? 400 : 500 },
      );
    }
    if (err instanceof ProlificApiError) {
      return NextResponse.json(
        {
          success: false,
          error: "prolific_api_error",
          status: err.status,
        },
        { status: err.status >= 400 && err.status < 500 ? 400 : 502 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : t("unexpected"),
      },
      { status: 500 },
    );
  }
}

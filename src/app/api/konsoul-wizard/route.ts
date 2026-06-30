import { NextResponse, type NextRequest } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { isKonsoulWizardEnabled } from "@/lib/konsoul/wizard-flag";
import { WizardAdvisorRequestSchema } from "@/lib/schemas/konsoul-wizard";
import {
  KonsoulWizardUnavailableError,
  runKonsoulWizardAdvisor,
} from "@/lib/konsoul/wizard/engine";

/**
 * POST /api/konsoul-wizard — Konsoul als Berater im Studien-Anlege-Assistenten.
 *
 * Eigene, schmale Route NEBEN /api/konsoul-agent (der live Sonnet-Orchestrator
 * bleibt unangetastet/byte-gleich). Sie nimmt einen Schnappschuss des aktuellen
 * Wizard-Stands + eine optionale Frage entgegen und gibt {answer, suggestions}
 * zurück — die Vorschläge sind bereits server-seitig sanitisiert (Enum-Allowlist,
 * no-op-Filter, Caps), sodass der Client sie gefahrlos via `patch()` übernehmen
 * kann.
 *
 * Auth STRIKT + ORG-SCOPED: orgId kommt aus requireOrgIdOrError() (die Session),
 * NIE aus dem Body — und wird in die (fail-open) Portfolio-Erdung der Engine
 * gereicht. Cross-Org-Zugriff ist damit strukturell unmöglich.
 *
 * Flag-gated: ist NEXT_PUBLIC_KONSOUL_WIZARD_ENABLED aus, antwortet die Route
 * mit 404 (Defense-in-Depth — die aufrufende Fläche wird dann ohnehin nicht
 * gerendert). Mergen ohne Flag ändert also nichts.
 *
 * Surface:
 *   404  — Flag aus (Feature existiert für den Client nicht)
 *   400  — ungültiger Body / Non-JSON
 *   401  — kein Auth
 *   403  — Auth ok, aber kein Org-Kontext
 *   500  — Engine warf (Modell down, Schema zweimal verfehlt) → fail-closed
 *   200  — { success: true, result: { answer, suggestions } }
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  const t = await getTranslations("errors");

  // Flag-Gate ZUERST: aus ⇒ verhalte dich, als gäbe es die Route nicht. Kein
  // Auth-/Modell-Aufwand, kein Org-Leak über Timing.
  if (!isKonsoulWizardEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  // Body wird direkt in den LLM-Prompt gelesen → die Schema-Caps halten einen
  // feindlichen Client davon ab, Modell-Tokens zu verbrennen (ein Opus-Call pro
  // Request kostet real).
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: t("invalidJsonBody") }, { status: 400 });
  }
  const parsed = WizardAdvisorRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const locale = await getLocale();
    const result = await runKonsoulWizardAdvisor({
      orgId,
      wizard: parsed.data.wizard,
      question: parsed.data.question,
      locale,
    });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error(
      "[POST /api/konsoul-wizard] engine failed:",
      err instanceof Error ? err.message : err,
    );
    const tAgent = await getTranslations("crossStudyAgent");
    return NextResponse.json(
      {
        error: tAgent("errEngine"),
        code:
          err instanceof KonsoulWizardUnavailableError ? "engine" : "unknown",
      },
      { status: 500 },
    );
  }
}

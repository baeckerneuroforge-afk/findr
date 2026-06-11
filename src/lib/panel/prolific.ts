import "server-only";

import { randomBytes } from "node:crypto";

import {
  buildPanelRedirectUrl,
  PROLIFIC_PID_PARAM,
  PROLIFIC_SESSION_ID_PARAM,
  PROLIFIC_STUDY_ID_PARAM,
} from "@/lib/research/panel";
import type {
  CreatePanelStudyDraftInput,
  PanelCredentialValidationResult,
  PanelProvider,
  PanelStudyDraft,
} from "./providers";
import {
  coerceSubmissionCounts,
  parseProlificCalculatedCost,
  parseProlificErrorMessage,
  parseProlificStudyCost,
  parseProlificStudySnapshot,
  type PanelStudyCost,
  type PanelStudySnapshot,
} from "./study-snapshot";

export const PROLIFIC_API_BASE = "https://api.prolific.com/api/v1";
const PROLIFIC_COMPLETION_BASE =
  "https://app.prolific.com/submissions/complete";

const PROLIFIC_PID_PLACEHOLDER = "{{%PROLIFIC_PID%}}";
const PROLIFIC_STUDY_ID_PLACEHOLDER = "{{%STUDY_ID%}}";
const PROLIFIC_SESSION_ID_PLACEHOLDER = "{{%SESSION_ID%}}";

export class ProlificApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** Wörtliche Provider-Meldung (title/detail aus dem dokumentierten
     *  Fehler-Envelope) — für die UI, z. B. bei unzureichendem Guthaben
     *  beim Publish. null, wenn die Antwort keinen Envelope trug. */
    public providerMessage: string | null = null,
  ) {
    super(message);
    this.name = "ProlificApiError";
  }
}

function trimToken(apiToken: string): string {
  return apiToken.trim();
}

async function prolificFetch(
  apiToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = trimToken(apiToken);
  return fetch(`${PROLIFIC_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Token ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(20_000),
  });
}

function completionUrlFromCode(code: string): string {
  const url = new URL(PROLIFIC_COMPLETION_BASE);
  url.searchParams.set("cc", code);
  const value = url.toString();
  if (!buildPanelRedirectUrl(value, "PID")) {
    throw new Error("Unsafe Prolific completion URL");
  }
  return value;
}

export function generateProlificCompletionCode(prefix: "C" | "S"): string {
  return `FD${prefix}${randomBytes(8).toString("hex").toUpperCase()}`;
}

export function getProlificCompletionUrls(codes: {
  completeCode: string;
  screenoutCode: string;
}) {
  return {
    complete_url: completionUrlFromCode(codes.completeCode),
    screenout_url: completionUrlFromCode(codes.screenoutCode),
    quotafull_url: null,
  };
}

function appendRawQueryParams(
  sourceUrl: string,
  params: Array<[string, string]>,
): string {
  const parsed = new URL(sourceUrl);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("externalStudyUrl must be http(s)");
  }

  const hashIndex = sourceUrl.indexOf("#");
  const base = hashIndex >= 0 ? sourceUrl.slice(0, hashIndex) : sourceUrl;
  const hash = hashIndex >= 0 ? sourceUrl.slice(hashIndex) : "";
  const separator = base.includes("?") ? "&" : "?";
  const query = params
    .map(([key, value]) => `${encodeURIComponent(key)}=${value}`)
    .join("&");
  return `${base}${separator}${query}${hash}`;
}

export function buildProlificExternalStudyUrl(openLinkUrl: string): string {
  return appendRawQueryParams(openLinkUrl, [
    [PROLIFIC_PID_PARAM, PROLIFIC_PID_PLACEHOLDER],
    [PROLIFIC_STUDY_ID_PARAM, PROLIFIC_STUDY_ID_PLACEHOLDER],
    [PROLIFIC_SESSION_ID_PARAM, PROLIFIC_SESSION_ID_PLACEHOLDER],
  ]);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export const prolificProvider: PanelProvider = {
  key: "prolific",

  async validateCredentials(
    apiToken: string,
  ): Promise<PanelCredentialValidationResult> {
    const response = await prolificFetch(apiToken, "/users/me/");
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "invalid" };
    }
    if (!response.ok) {
      return { ok: false, reason: "unavailable" };
    }

    const json = (await response.json().catch(() => null)) as unknown;
    if (!json || typeof json !== "object") {
      return { ok: false, reason: "unavailable" };
    }
    const row = json as Record<string, unknown>;
    const id = getString(row.id);
    if (!id) return { ok: false, reason: "unavailable" };

    return {
      ok: true,
      providerUserId: id,
      providerUserEmail: getString(row.email),
    };
  },

  getCompletionUrls: getProlificCompletionUrls,

  async createStudyDraft(
    apiToken: string,
    input: CreatePanelStudyDraftInput,
  ): Promise<PanelStudyDraft> {
    const completeCode = generateProlificCompletionCode("C");
    const screenoutCode = generateProlificCompletionCode("S");
    const completion = getProlificCompletionUrls({ completeCode, screenoutCode });

    const payload = {
      name: input.name,
      internal_name: input.name,
      description: input.description,
      external_study_url: input.externalStudyUrl,
      prolific_id_option: "url_parameters",
      total_available_places: input.totalAvailablePlaces,
      estimated_completion_time: input.estimatedCompletionTime,
      reward: input.rewardCents,
      device_compatibility: ["desktop"],
      peripheral_requirements: [],
      filters: [],
      submissions_config: {
        max_submissions_per_participant: 1,
      },
      completion_codes: [
        {
          code: completeCode,
          code_type: "COMPLETED",
          actions: [{ action: "MANUALLY_REVIEW" }],
        },
        {
          code: screenoutCode,
          code_type: "SCREENED_OUT",
          actions: [
            {
              action: "FIXED_SCREEN_OUT_PAYMENT",
              fixed_screen_out_reward: input.screenoutRewardCents,
              slots: input.screenoutSlots,
            },
          ],
        },
      ],
    };

    const response = await prolificFetch(apiToken, "/studies/", {
      method: "POST",
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new ProlificApiError(
        `Prolific draft creation failed with status ${response.status}`,
        response.status,
      );
    }

    const json = (await response.json()) as Record<string, unknown>;
    const providerStudyId = getString(json.id);
    if (!providerStudyId) {
      throw new ProlificApiError(
        "Prolific draft creation returned no study id",
        response.status,
      );
    }

    return {
      provider: "prolific",
      providerStudyId,
      status: getString(json.status) ?? "UNPUBLISHED",
      externalStudyUrl: input.externalStudyUrl,
      completion,
    };
  },

  // ── E5: Sync-Capabilities ────────────────────────────────────────────
  // Endpoints verifiziert gegen docs.prolific.com (api-reference/studies/
  // get-study.md + count-study-submissions-by-status.md, 2026-06-11):
  //   GET /studies/{id}/                      → u. a. status-Enum
  //   GET /studies/{id}/submissions/counts/   → flaches Bucket→Zahl-Objekt
  // total_cost/places_taken sind dort NICHT dokumentiert — Kosten bleiben
  // E6 (eigener, dokumentierter Weg) vorbehalten.

  async getStudy(
    apiToken: string,
    providerStudyId: string,
  ): Promise<PanelStudySnapshot> {
    const response = await prolificFetch(
      apiToken,
      `/studies/${encodeURIComponent(providerStudyId)}/`,
    );
    if (!response.ok) {
      throw new ProlificApiError(
        `Prolific study fetch failed with status ${response.status}`,
        response.status,
      );
    }
    const snapshot = parseProlificStudySnapshot(
      await response.json().catch(() => null),
    );
    if (!snapshot) {
      throw new ProlificApiError(
        "Prolific study fetch returned no status",
        response.status,
      );
    }
    return snapshot;
  },

  async listSubmissionCounts(
    apiToken: string,
    providerStudyId: string,
  ): Promise<Record<string, number>> {
    const response = await prolificFetch(
      apiToken,
      `/studies/${encodeURIComponent(providerStudyId)}/submissions/counts/`,
    );
    if (!response.ok) {
      throw new ProlificApiError(
        `Prolific submission counts failed with status ${response.status}`,
        response.status,
      );
    }
    const counts = coerceSubmissionCounts(
      await response.json().catch(() => null),
    );
    if (!counts) {
      throw new ProlificApiError(
        "Prolific submission counts returned an unexpected shape",
        response.status,
      );
    }
    return counts;
  },

  // ── E6: Kosten-Capabilities ──────────────────────────────────────────
  // Endpoints verifiziert gegen docs.prolific.com (api-reference/studies/
  // calculate-study-cost.md + get-study-cost.md, 2026-06-11):
  //   POST /study-cost-calculator/ { reward, total_available_places }
  //     → { total_cost } in Cents, INKL. Fees+VAT aus den Account-
  //     Einstellungen (keine Prozente im Code), Account-Währung.
  //   GET /studies/{id}/cost/?is_projected= → StudyTotalCost-Breakdown.

  async estimateCost(
    apiToken: string,
    input: { rewardCents: number; totalAvailablePlaces: number },
  ): Promise<number> {
    const response = await prolificFetch(apiToken, "/study-cost-calculator/", {
      method: "POST",
      body: JSON.stringify({
        reward: input.rewardCents,
        total_available_places: input.totalAvailablePlaces,
      }),
    });
    if (!response.ok) {
      throw new ProlificApiError(
        `Prolific cost calculation failed with status ${response.status}`,
        response.status,
      );
    }
    const total = parseProlificCalculatedCost(
      await response.json().catch(() => null),
    );
    if (total === null) {
      throw new ProlificApiError(
        "Prolific cost calculation returned an unexpected shape",
        response.status,
      );
    }
    return total;
  },

  async getStudyCost(
    apiToken: string,
    providerStudyId: string,
    options: { projected: boolean },
  ): Promise<PanelStudyCost> {
    const response = await prolificFetch(
      apiToken,
      `/studies/${encodeURIComponent(providerStudyId)}/cost/?is_projected=${
        options.projected ? "true" : "false"
      }`,
    );
    if (!response.ok) {
      throw new ProlificApiError(
        `Prolific study cost failed with status ${response.status}`,
        response.status,
      );
    }
    const cost = parseProlificStudyCost(await response.json().catch(() => null));
    if (!cost) {
      throw new ProlificApiError(
        "Prolific study cost returned an unexpected shape",
        response.status,
      );
    }
    return cost;
  },

  // ── E7: Publish ──────────────────────────────────────────────────────
  // Endpoint verifiziert gegen docs.prolific.com (api-reference/studies/
  // publish-study.md, 2026-06-11): POST /studies/{id}/transition/ mit
  // {"action":"PUBLISH"} → 200 + aktualisiertes Study-Objekt (inkl.
  // status). Fehler: 400 mit dokumentiertem Envelope { error: { title,
  // detail, … } } — eine spezifische Insufficient-Funds-Form ist NICHT
  // dokumentiert, deshalb wird title/detail wörtlich als providerMessage
  // durchgereicht (die UI zeigt Prolifics eigene Begründung).

  async publishStudy(
    apiToken: string,
    providerStudyId: string,
  ): Promise<PanelStudySnapshot> {
    const response = await prolificFetch(
      apiToken,
      `/studies/${encodeURIComponent(providerStudyId)}/transition/`,
      {
        method: "POST",
        body: JSON.stringify({ action: "PUBLISH" }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok) {
      const providerMessage = parseProlificErrorMessage(
        await response.json().catch(() => null),
      );
      throw new ProlificApiError(
        `Prolific publish failed with status ${response.status}`,
        response.status,
        providerMessage,
      );
    }
    const snapshot = parseProlificStudySnapshot(
      await response.json().catch(() => null),
    );
    if (!snapshot) {
      throw new ProlificApiError(
        "Prolific publish returned no status",
        response.status,
      );
    }
    return snapshot;
  },
};

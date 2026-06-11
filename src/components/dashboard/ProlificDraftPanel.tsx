"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FIELD_INPUT_CLASS } from "@/components/ui/Field";

/** Persistierter Draft aus panel_studies (E4) — Server-seitig geladen, damit
 *  die angelegte Studie einen Reload überlebt (vorher nur transienter
 *  Client-State = Doppel-Draft-Risiko). Bewusst nur in den connected+active-
 *  Zustand gerendert: die Early-Return-Hinweise (Credential/Open-Link fehlen)
 *  bleiben unverändert, weil dort ohnehin kein Draft entstehen kann. */
interface PersistedPanelStudy {
  providerStudyId: string;
  status: string;
  createdAt: string;
  /** Provider-Buckets → Anzahl (E5-Sync); null = noch nie synchronisiert. */
  submissionCounts: Record<string, number> | null;
  /** Projizierte Gesamtkosten in Cents (E6, via Sync); null = nie geholt. */
  totalCostCents: number | null;
  lastSyncedAt: string | null;
}

/** Cents → "12.34" — bewusst toFixed statt toLocaleString (deterministisch
 *  zwischen Server-Pass und Client, kein Hydration-Drift). Die Währung kennt
 *  nur der Prolific-Account; die Copy sagt das explizit dazu. */
function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Anzeige-Reihenfolge der dokumentierten Prolific-Buckets; unbekannte
 *  künftige Buckets werden hinten angehängt, Null-Stände unterdrückt. */
const COUNT_ORDER = [
  "ACTIVE",
  "APPROVED",
  "AWAITING REVIEW",
  "REJECTED",
  "RESERVED",
  "RETURNED",
  "TIMED-OUT",
  "PARTIALLY APPROVED",
  "SCREENED OUT",
];

function formatSubmissionCounts(
  counts: Record<string, number>,
  labels: { total: (n: number) => string; none: string },
): string {
  // Bucket-Namen sind Provider-Vokabular (ACTIVE, "AWAITING REVIEW", …) und
  // bleiben bewusst unübersetzt — nur die findr-eigenen Tokens (gesamt /
  // noch keine) sind lokalisiert.
  const parts = COUNT_ORDER.filter((k) => (counts[k] ?? 0) > 0).map(
    (k) => `${counts[k]} ${k.toLowerCase()}`,
  );
  const known = new Set([...COUNT_ORDER, "TOTAL"]);
  for (const [k, v] of Object.entries(counts)) {
    if (!known.has(k) && v > 0) parts.push(`${v} ${k.toLowerCase()}`);
  }
  const total = typeof counts.TOTAL === "number" ? counts.TOTAL : null;
  if (parts.length === 0) {
    return total !== null ? labels.total(total) : labels.none;
  }
  return total !== null
    ? `${parts.join(" · ")} · ${labels.total(total)}`
    : parts.join(" · ");
}

interface ProlificDraftPanelProps {
  planId: string;
  planTitle: string;
  planObjective: string;
  sampleTarget: number | null;
  openLink:
    | {
        status: "active" | "disabled";
        maxSessions: number | null;
      }
    | null;
  credentialStatus: "connected" | "invalid" | "unknown" | "missing";
  panelCompletionConfigured: boolean;
  panelStudy: PersistedPanelStudy | null;
  disabled?: boolean;
}

interface DraftResponse {
  success?: boolean;
  error?: string;
  status?: number;
  draft?: {
    providerStudyId: string;
    status: string;
  };
}

function stringNumber(value: number | null | undefined, fallback: number) {
  return String(value && value > 0 ? value : fallback);
}

export function ProlificDraftPanel({
  planId,
  planTitle,
  planObjective,
  sampleTarget,
  openLink,
  credentialStatus,
  panelCompletionConfigured,
  panelStudy,
  disabled = false,
}: ProlificDraftPanelProps) {
  const router = useRouter();
  const t = useTranslations("research.panel");
  const tc = useTranslations("research.common");
  const defaultPlaces = sampleTarget ?? openLink?.maxSessions ?? 10;
  const [name, setName] = useState(planTitle);
  const [description, setDescription] = useState(planObjective);
  const [totalPlaces, setTotalPlaces] = useState(
    stringNumber(defaultPlaces, 10),
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState("30");
  const [rewardCents, setRewardCents] = useState("500");
  const [screenoutRewardCents, setScreenoutRewardCents] = useState("10");
  const [screenoutSlots, setScreenoutSlots] = useState(
    stringNumber(defaultPlaces, 10),
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    id: string;
    status: string;
  } | null>(null);
  // Existiert bereits ein persistierter Draft, ist das Formular eingeklappt —
  // der Default-Pfad zeigt die Studie statt zur Zweit-Anlage einzuladen.
  // "Create another draft" bleibt als bewusste Handlung möglich.
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [estimating, setEstimating] = useState(false);
  // Kostenvorschau (E6) — gilt nur für die Eingaben, mit denen sie berechnet
  // wurde; Reward-/Places-Änderungen verwerfen sie (Stale-Schutz).
  const [estimateCents, setEstimateCents] = useState<number | null>(null);
  // E7: zweistufiger Publish — erst expliziter Confirm-Schritt (geld-nah!),
  // dann POST. findr published nie ohne diese Bestätigung.
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Test-Modus: gratis Klon-Publish an die Workspace-Test-Teilnehmer —
  // Ergebnis (ID + Teilnahme-Link) bleibt transient, die Karte zeigt
  // weiterhin den echten Rekrutierungs-Draft.
  const [testCreating, setTestCreating] = useState(false);
  const [testStudy, setTestStudy] = useState<{
    providerStudyId: string;
    studyUrl: string;
  } | null>(null);

  const canCreate =
    !disabled && credentialStatus === "connected" && openLink?.status === "active";
  const formVisible = panelStudy === null || showCreateForm;

  // E7: Publish — die geld-nahe Aktion. Server erzwingt alle Preconditions
  // erneut (inkl. Live-Status-Check gegen Doppel-Publish); hier nur UI-Fluss.
  // Fehlertexte: Prolifics wörtliche Begründung (detail) hat Vorrang — z. B.
  // bei unzureichendem Workspace-Guthaben.
  async function handlePublish() {
    setError(null);
    setPublishing(true);
    try {
      const res = await fetch(`/api/research/plans/${planId}/panel/publish`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        status?: string;
        error?: string;
        detail?: string | null;
        providerStatus?: string;
      };
      if (!res.ok || data.success === false) {
        setError(
          data.detail ??
            (data.error === "not_unpublished" && data.providerStatus
              ? t("errNotUnpublished", { status: data.providerStatus })
              : (data.error ?? t("errPublish"))),
        );
        // Bei Status-Konflikt den echten Stand nachladen — Badge und
        // Publish-Sichtbarkeit richten sich dann nach der Wahrheit.
        if (data.error === "not_unpublished") router.refresh();
        return;
      }
      setConfirmingPublish(false);
      router.refresh();
    } catch {
      setError(t("errPublish"));
    } finally {
      setPublishing(false);
    }
  }

  // Test-Modus: kostenloser End-to-End-Probelauf — Prolific klont den Draft
  // als Test-Studie (eigene ID + URL) für die Test-Teilnehmer des Workspace.
  // Preconditions erzwingt der Server (wie beim echten Publish); fehlende
  // Workspace-Voraussetzungen meldet Prolific wörtlich (detail).
  async function handleTestStudy() {
    setError(null);
    setTestCreating(true);
    try {
      const res = await fetch(
        `/api/research/plans/${planId}/panel/test-study`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        providerStudyId?: string;
        studyUrl?: string;
        error?: string;
        detail?: string | null;
      };
      if (
        !res.ok ||
        data.success === false ||
        typeof data.providerStudyId !== "string" ||
        typeof data.studyUrl !== "string"
      ) {
        setError(data.detail ?? (data.error ?? t("errTestStudy")));
        return;
      }
      setTestStudy({
        providerStudyId: data.providerStudyId,
        studyUrl: data.studyUrl,
      });
    } catch {
      setError(t("errTestStudy"));
    } finally {
      setTestCreating(false);
    }
  }

  // E6: Kostenvorschau über Prolifics Kalkulator (Fees/VAT aus den
  // Account-Einstellungen — nichts hartkodiert). Kennt nur reward × places;
  // das Screen-out-Budget ist nicht enthalten (Disclaimer in der Anzeige).
  async function handleEstimate() {
    setError(null);
    setEstimateCents(null);
    const totalAvailablePlaces = readPositiveInt(totalPlaces, t("fieldPlaces"));
    const reward = readPositiveInt(rewardCents, t("fieldReward"));
    if (totalAvailablePlaces === null || reward === null) return;

    setEstimating(true);
    try {
      const res = await fetch(
        `/api/research/plans/${planId}/panel/cost-estimate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rewardCents: reward,
            totalAvailablePlaces,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        totalCostCents?: number;
        error?: string;
      };
      if (!res.ok || data.success === false || typeof data.totalCostCents !== "number") {
        setError(data.error ?? t("errEstimate"));
        return;
      }
      setEstimateCents(data.totalCostCents);
    } catch {
      setError(t("errEstimate"));
    } finally {
      setEstimating(false);
    }
  }

  // E5: manueller Sync — Status + Submission-Zähler von Prolific holen; das
  // Ergebnis kommt über router.refresh() als frische panelStudy-Prop zurück
  // (Server liest panel_studies), kein lokales Zustands-Doppel.
  async function handleSync() {
    setError(null);
    setSyncing(true);
    try {
      const res = await fetch(`/api/research/plans/${planId}/panel/sync`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || data.success === false) {
        setError(data.error ?? t("errRefresh"));
        return;
      }
      router.refresh();
    } catch {
      // Netzwerk-Throw von fetch selbst (offline o. Ä.) — sichtbar machen
      // statt als unhandled rejection zu verschwinden.
      setError(t("errRefresh"));
    } finally {
      setSyncing(false);
    }
  }

  function readPositiveInt(value: string, label: string): number | null {
    const n = Number(value.trim());
    if (!Number.isInteger(n) || n < 1) {
      setError(t("valWholeNumber", { label }));
      return null;
    }
    return n;
  }

  async function handleCreate() {
    setCreated(null);
    setError(null);
    const totalAvailablePlaces = readPositiveInt(totalPlaces, t("fieldPlaces"));
    const estimatedCompletionTime = readPositiveInt(
      estimatedMinutes,
      t("fieldMinutes"),
    );
    const reward = readPositiveInt(rewardCents, t("fieldReward"));
    const screenoutReward = readPositiveInt(
      screenoutRewardCents,
      t("fieldScreenoutReward"),
    );
    const slots = readPositiveInt(screenoutSlots, t("fieldScreenoutSlots"));
    if (
      totalAvailablePlaces === null ||
      estimatedCompletionTime === null ||
      reward === null ||
      screenoutReward === null ||
      slots === null
    ) {
      return;
    }
    if (screenoutReward < 10) {
      setError(t("valScreenoutMin"));
      return;
    }
    if (screenoutReward >= reward) {
      setError(t("valScreenoutLtReward"));
      return;
    }
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName || !trimmedDescription) {
      setError(t("valNameDescRequired"));
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(
        `/api/research/plans/${planId}/panel/prolific-draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            description: trimmedDescription,
            totalAvailablePlaces,
            estimatedCompletionTime,
            rewardCents: reward,
            screenoutRewardCents: screenoutReward,
            screenoutSlots: slots,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as DraftResponse;
      if (!res.ok || data.success === false || !data.draft) {
        setError(data.error ?? t("errCreate"));
        return;
      }
      setCreated({
        id: data.draft.providerStudyId,
        status: data.draft.status,
      });
      // Nach Erfolg wieder einklappen; router.refresh() holt den persistierten
      // Draft als panelStudy-Prop in die Karte oben.
      setShowCreateForm(false);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  if (credentialStatus !== "connected") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant={credentialStatus === "invalid" ? "critical" : "default"}>
            {credentialStatus === "invalid"
              ? t("badgeInvalidToken")
              : t("badgeNotConnected")}
          </Badge>
          <p className="mt-2 text-small text-neutral-600">{t("connectFirst")}</p>
        </div>
        <Link
          href="/dashboard/integrations/prolific"
          className="inline-flex h-8 items-center justify-center rounded-md border border-neutral-200 bg-white px-3 text-body-strong font-medium text-neutral-900 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
        >
          {t("openSettings")}
        </Link>
      </div>
    );
  }

  if (!openLink) {
    return (
      <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-small text-neutral-600">
        {t("createLinkFirst")}
      </p>
    );
  }

  if (openLink.status !== "active") {
    return (
      <p className="rounded-md border border-dashed border-warning-500/40 bg-warning-50 px-3 py-4 text-small text-warning-700">
        {t("activateLinkFirst")}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={panelCompletionConfigured ? "success" : "default"}>
          {panelCompletionConfigured ? t("badgeWired") : t("badgeNotWired")}
        </Badge>
        <span className="text-small text-neutral-600">{t("wiredHint")}</span>
      </div>

      {panelStudy && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-small">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-neutral-900">{t("draftTitle")}</span>
            {/* Status-Werte sind Provider-Vokabular (UNPUBLISHED, ACTIVE, …)
                und bleiben bewusst unübersetzt. */}
            <Badge variant={panelStudy.status === "ACTIVE" ? "success" : "default"}>
              {panelStudy.status}
            </Badge>
          </div>
          <div className="mt-1 font-mono text-neutral-700">
            {panelStudy.providerStudyId}
          </div>
          <p className="mt-1 text-neutral-600">
            {/* ISO-Datum statt toLocaleDateString — deterministisch zwischen
                Server-Pass und Client (kein Hydration-Drift). */}
            {t("createdLine", { date: panelStudy.createdAt.slice(0, 10) })}
          </p>
          {panelStudy.submissionCounts && (
            <p className="mt-1 text-neutral-700">
              {t("submissionsLine", {
                counts: formatSubmissionCounts(panelStudy.submissionCounts, {
                  total: (n) => t("submissionsTotal", { count: n }),
                  none: t("submissionsNone"),
                }),
              })}
            </p>
          )}
          {panelStudy.totalCostCents !== null && (
            <p className="mt-1 text-neutral-700">
              {t("projectedCost", {
                amount: formatCents(panelStudy.totalCostCents),
              })}
            </p>
          )}
          {panelStudy.lastSyncedAt && (
            <p className="mt-1 text-caption text-neutral-500">
              {t("lastSynced", {
                when: panelStudy.lastSyncedAt.slice(0, 16).replace("T", " "),
              })}
            </p>
          )}
          {!disabled && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={handleSync} disabled={syncing}>
                {syncing ? t("refreshing") : t("refresh")}
              </Button>
              {panelStudy.status === "UNPUBLISHED" &&
                canCreate &&
                panelCompletionConfigured &&
                !confirmingPublish && (
                  <Button
                    onClick={() => {
                      // Confirm öffnen UND frisch syncen — der Bestätigungs-
                      // text soll die aktuellen projizierten Kosten zeigen.
                      setConfirmingPublish(true);
                      void handleSync();
                    }}
                    disabled={syncing || publishing}
                  >
                    {t("publishCta")}
                  </Button>
                )}
              {panelStudy.status === "UNPUBLISHED" &&
                canCreate &&
                panelCompletionConfigured && (
                  <Button
                    variant="ghost"
                    onClick={handleTestStudy}
                    disabled={testCreating || publishing}
                  >
                    {testCreating ? t("testStudyCreating") : t("testStudyCta")}
                  </Button>
                )}
            </div>
          )}

          {testStudy && (
            <div className="mt-3 rounded-md bg-success-50 px-3 py-2 text-small text-success-700">
              {t("testStudyCreated")}{" "}
              <span className="font-mono">{testStudy.providerStudyId}</span> —{" "}
              <a
                href={testStudy.studyUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline decoration-success-700/40 underline-offset-2"
              >
                {t("testStudyOpen")}
              </a>
              . {t("testStudyNote")}
            </div>
          )}

          {confirmingPublish && panelStudy.status === "UNPUBLISHED" && !disabled && (
            <div className="mt-3 rounded-md border border-warning-500/40 bg-warning-50 px-3 py-3">
              <p className="text-small font-medium text-neutral-900">
                {t("confirmTitle")}
              </p>
              <p className="mt-1 text-small text-neutral-700">
                {panelStudy.totalCostCents !== null
                  ? t("confirmBodyWithCost", {
                      amount: formatCents(panelStudy.totalCostCents),
                    })
                  : t("confirmBodyNoCost")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button onClick={handlePublish} disabled={publishing || syncing}>
                  {publishing ? t("publishing") : t("confirmYes")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmingPublish(false)}
                  disabled={publishing}
                >
                  {tc("cancel")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {formVisible && (
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-small font-medium text-neutral-700">
            {t("fieldName")}
          </span>
          <input
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            disabled={disabled || creating}
            className={FIELD_INPUT_CLASS}
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-small font-medium text-neutral-700">
            {t("fieldDescription")}
          </span>
          <textarea
            value={description}
            maxLength={4_000}
            onChange={(e) => setDescription(e.target.value)}
            disabled={disabled || creating}
            className={`${FIELD_INPUT_CLASS} min-h-28 py-2`}
          />
        </label>

        <NumberField
          label={t("fieldPlaces")}
          value={totalPlaces}
          onChange={(v) => {
            setTotalPlaces(v);
            setEstimateCents(null);
          }}
          disabled={disabled || creating}
        />
        <NumberField
          label={t("fieldMinutes")}
          value={estimatedMinutes}
          onChange={setEstimatedMinutes}
          disabled={disabled || creating}
        />
        <NumberField
          label={t("fieldReward")}
          value={rewardCents}
          onChange={(v) => {
            setRewardCents(v);
            setEstimateCents(null);
          }}
          disabled={disabled || creating}
        />
        <NumberField
          label={t("fieldScreenoutReward")}
          value={screenoutRewardCents}
          onChange={setScreenoutRewardCents}
          disabled={disabled || creating}
        />
        <NumberField
          label={t("fieldScreenoutSlots")}
          value={screenoutSlots}
          onChange={setScreenoutSlots}
          disabled={disabled || creating}
        />
      </div>
      )}

      {formVisible && !disabled && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleCreate} disabled={!canCreate || creating}>
            {creating ? t("creating") : t("create")}
          </Button>
          <Button
            variant="ghost"
            onClick={handleEstimate}
            disabled={!canCreate || creating || estimating}
          >
            {estimating ? t("estimating") : t("estimate")}
          </Button>
        </div>
      )}

      {formVisible && estimateCents !== null && (
        <p className="text-small text-neutral-700">
          {t("estimateLine", { amount: formatCents(estimateCents) })}
        </p>
      )}

      {!formVisible && !disabled && (
        <Button variant="ghost" onClick={() => setShowCreateForm(true)}>
          {t("createAnother")}
        </Button>
      )}

      {/* Transientes Erfolgs-Banner nur, solange die persistierte Karte oben
          nicht bereits dieselbe Studie zeigt (nach router.refresh kommt sie
          als panelStudy-Prop an — und vor angewandter Migration bleibt das
          Banner der einzige Beleg). */}
      {created && created.id !== panelStudy?.providerStudyId && (
        <div className="rounded-md bg-success-50 px-3 py-2 text-small text-success-700">
          {t("createdBanner", { id: created.id, status: created.status })}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-small font-medium text-neutral-700">
        {label}
      </span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={FIELD_INPUT_CLASS}
      />
    </label>
  );
}

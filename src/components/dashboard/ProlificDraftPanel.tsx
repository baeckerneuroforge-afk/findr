"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FIELD_INPUT_CLASS } from "@/components/ui/Field";

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
  disabled = false,
}: ProlificDraftPanelProps) {
  const router = useRouter();
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

  const canCreate =
    !disabled && credentialStatus === "connected" && openLink?.status === "active";

  function readPositiveInt(value: string, label: string): number | null {
    const n = Number(value.trim());
    if (!Number.isInteger(n) || n < 1) {
      setError(`${label} must be a whole number greater than zero.`);
      return null;
    }
    return n;
  }

  async function handleCreate() {
    setCreated(null);
    setError(null);
    const totalAvailablePlaces = readPositiveInt(totalPlaces, "Places");
    const estimatedCompletionTime = readPositiveInt(
      estimatedMinutes,
      "Estimated minutes",
    );
    const reward = readPositiveInt(rewardCents, "Reward");
    const screenoutReward = readPositiveInt(
      screenoutRewardCents,
      "Screen-out reward",
    );
    const slots = readPositiveInt(screenoutSlots, "Screen-out slots");
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
      setError("Screen-out reward must be at least 10 cents.");
      return;
    }
    if (screenoutReward >= reward) {
      setError("Screen-out reward must be lower than the completion reward.");
      return;
    }
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName || !trimmedDescription) {
      setError("Name and description are required.");
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
        setError(data.error ?? "Could not create draft study.");
        return;
      }
      setCreated({
        id: data.draft.providerStudyId,
        status: data.draft.status,
      });
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
            {credentialStatus === "invalid" ? "Invalid token" : "Not connected"}
          </Badge>
          <p className="mt-2 text-small text-neutral-600">
            Connect Prolific before creating a draft study.
          </p>
        </div>
        <Link
          href="/dashboard/integrations/prolific"
          className="inline-flex h-8 items-center justify-center rounded-md border border-neutral-200 bg-white px-3 text-body-strong font-medium text-neutral-900 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
        >
          Open settings
        </Link>
      </div>
    );
  }

  if (!openLink) {
    return (
      <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-small text-neutral-600">
        Create the open link above first.
      </p>
    );
  }

  if (openLink.status !== "active") {
    return (
      <p className="rounded-md border border-dashed border-warning-500/40 bg-warning-50 px-3 py-4 text-small text-warning-700">
        Activate the open link above before creating a Prolific draft.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={panelCompletionConfigured ? "success" : "default"}>
          {panelCompletionConfigured ? "Completion wired" : "Not wired"}
        </Badge>
        <span className="text-small text-neutral-600">
          Draft creation writes complete and screen-out URLs to this open link.
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-small font-medium text-neutral-700">
            Study name
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
            Prolific description
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
          label="Places"
          value={totalPlaces}
          onChange={setTotalPlaces}
          disabled={disabled || creating}
        />
        <NumberField
          label="Estimated minutes"
          value={estimatedMinutes}
          onChange={setEstimatedMinutes}
          disabled={disabled || creating}
        />
        <NumberField
          label="Reward cents"
          value={rewardCents}
          onChange={setRewardCents}
          disabled={disabled || creating}
        />
        <NumberField
          label="Screen-out reward cents"
          value={screenoutRewardCents}
          onChange={setScreenoutRewardCents}
          disabled={disabled || creating}
        />
        <NumberField
          label="Screen-out slots"
          value={screenoutSlots}
          onChange={setScreenoutSlots}
          disabled={disabled || creating}
        />
      </div>

      {!disabled && (
        <Button onClick={handleCreate} disabled={!canCreate || creating}>
          {creating ? "Creating..." : "Create Prolific draft"}
        </Button>
      )}

      {created && (
        <div className="rounded-md bg-success-50 px-3 py-2 text-small text-success-700">
          Draft created: {created.id} ({created.status}). Publish and fund it in
          Prolific.
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

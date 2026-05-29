"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import type { HubspotIntegration } from "@/lib/hubspot/service";
import { Button } from "@/components/ui/Button";
import { toBcp47 } from "@/i18n/locale";

interface Props {
  initialIntegration: HubspotIntegration | null;
  connectedFlag: boolean;
  errorFlag?: string;
}

export function HubspotSettingsPanel({
  initialIntegration,
  connectedFlag,
  errorFlag,
}: Props) {
  const router = useRouter();
  const locale = useLocale();
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(
    errorFlag
      ? { type: "error", msg: `OAuth error: ${errorFlag}` }
      : connectedFlag
        ? {
            type: "success",
            msg: "Connected. Run sync to import your deals.",
          }
        : null,
  );

  async function handleSync() {
    setSyncing(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/integrations/hubspot/sync", {
        method: "POST",
      });
      const data = (await res.json()) as
        | { success: true; synced: number; errors?: string[] }
        | { success: false; error?: string };

      if (data.success) {
        setFeedback({
          type: "success",
          msg: `Synced ${data.synced} deals.${
            data.errors?.length ? ` ${data.errors.length} errors.` : ""
          }`,
        });
        router.refresh();
      } else {
        setFeedback({ type: "error", msg: data.error ?? "Sync failed" });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSyncing(false);
    }
  }

  if (!initialIntegration) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-primary-100 bg-primary-50 p-6">
          <h3 className="mb-3 text-h2 text-neutral-900">
            Connect your Hubspot account
          </h3>
          <p className="mb-5 text-body text-neutral-700">
            Findr will read your deals, companies, and owners. We never write
            back to Hubspot.
          </p>
          <ul className="mb-6 space-y-2 text-body text-neutral-700">
            <li>· Deals (read-only)</li>
            <li>· Companies (read-only)</li>
            <li>· Owners (read-only)</li>
          </ul>

          <a
            href="/api/integrations/hubspot/connect"
            className="inline-flex h-8 items-center justify-center rounded-md bg-neutral-900 px-3 text-body-strong font-medium text-white transition-colors hover:bg-neutral-700"
          >
            Connect Hubspot
          </a>
        </div>

        {feedback && <FeedbackMessage feedback={feedback} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-success-500/30 bg-success-50 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-h2 text-neutral-900">Connected</h3>
            <p className="mt-1 text-caption text-neutral-500">
              Portal ID {initialIntegration.hubspot_portal_id}
            </p>
          </div>
          <div className="rounded-md bg-success-500/15 px-3 py-1 text-caption font-medium text-success-700">
            Active
          </div>
        </div>

        <div className="mb-5 space-y-1 text-small text-neutral-700">
          <div>
            Last sync:{" "}
            {initialIntegration.last_synced_at
              ? new Date(initialIntegration.last_synced_at).toLocaleString(
                  toBcp47(locale),
                )
              : "never"}
          </div>
          <div>Status: {initialIntegration.sync_status}</div>
          {initialIntegration.sync_error && (
            <div className="mt-2 text-warning-700">
              Last error: {initialIntegration.sync_error}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={handleSync} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync now"}
          </Button>

          <a
            href="/api/integrations/hubspot/connect"
            className="inline-flex h-8 items-center justify-center rounded-md border border-neutral-200 bg-white px-3 text-body-strong font-medium text-neutral-900 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            Reconnect
          </a>
        </div>
      </div>

      {feedback && <FeedbackMessage feedback={feedback} />}
    </div>
  );
}

function FeedbackMessage({
  feedback,
}: {
  feedback: { type: "success" | "error"; msg: string };
}) {
  return (
    <div
      className={`rounded-md px-3 py-2 text-small font-medium ${
        feedback.type === "error"
          ? "bg-danger-50 text-danger-700"
          : "bg-success-50 text-success-700"
      }`}
    >
      {feedback.msg}
    </div>
  );
}

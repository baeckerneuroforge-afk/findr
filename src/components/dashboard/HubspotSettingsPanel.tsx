"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HubspotIntegration } from "@/lib/hubspot/service";

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
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-6">
          <h3 className="mb-3 font-semibold text-white">
            Connect your Hubspot account
          </h3>
          <p className="mb-5 text-sm text-mist/70">
            Findr will read your deals, companies, and owners. We never write
            back to Hubspot.
          </p>
          <ul className="mb-6 space-y-2 text-sm text-mist/60">
            <li>Deals (read-only)</li>
            <li>Companies (read-only)</li>
            <li>Owners (read-only)</li>
          </ul>

          <a
            href="/api/integrations/hubspot/connect"
            className="inline-block rounded-lg bg-orange-500 px-5 py-2.5 font-medium text-white transition-colors hover:bg-orange-400"
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
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-white">Connected</h3>
            <p className="mt-1 text-xs text-mist/50">
              Portal ID {initialIntegration.hubspot_portal_id}
            </p>
          </div>
          <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
            Active
          </div>
        </div>

        <div className="mb-5 space-y-1 text-xs text-mist/60">
          <div>
            Last sync:{" "}
            {initialIntegration.last_synced_at
              ? new Date(initialIntegration.last_synced_at).toLocaleString(
                  "de-DE",
                )
              : "never"}
          </div>
          <div>Status: {initialIntegration.sync_status}</div>
          {initialIntegration.sync_error && (
            <div className="mt-2 text-orange-400">
              Last error: {initialIntegration.sync_error}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg bg-violet-500 px-5 py-2 font-medium text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync now"}
          </button>

          <a
            href="/api/integrations/hubspot/connect"
            className="rounded-lg border border-white/10 px-5 py-2 font-medium text-white transition-colors hover:border-white/20"
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
      className={`text-sm ${
        feedback.type === "error" ? "text-red-400" : "text-emerald-400"
      }`}
    >
      {feedback.msg}
    </div>
  );
}

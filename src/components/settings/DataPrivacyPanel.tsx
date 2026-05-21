"use client";

import { useState } from "react";

interface DataPrivacyPanelProps {
  isAdmin: boolean;
  organizationName: string;
}

export function DataPrivacyPanel({
  isAdmin,
  organizationName,
}: DataPrivacyPanelProps) {
  const [confirmationName, setConfirmationName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/delete-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationName }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Delete failed");
      }
      setMessage("Organization data deleted. The Clerk organization remains active.");
      setConfirmationName("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-h2 text-neutral-900">Data export</h2>
        <p className="mt-1 max-w-2xl text-body text-neutral-500">
          Export all organization-scoped Findr data as JSON. Integration
          secrets such as OAuth tokens and Slack webhook URLs are excluded.
        </p>
        <a
          href="/api/settings/export"
          className={`mt-5 inline-flex h-8 items-center justify-center rounded-md px-3 text-body-strong font-medium transition-colors ${
            isAdmin
              ? "bg-primary-600 text-white hover:bg-primary-700"
              : "pointer-events-none bg-neutral-100 text-neutral-400"
          }`}
          aria-disabled={!isAdmin}
        >
          Export all data
        </a>
        {!isAdmin && (
          <p className="mt-2 text-small text-neutral-500">
            Only organization admins can export data.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-h2 text-neutral-900">DSGVO / GDPR posture</h2>
        <p className="mt-1 max-w-2xl text-body text-neutral-500">
          Findr is designed for DACH sales teams: organization data can be
          exported, deleted, and kept separate by tenant. Production deployments
          should use EU-hosted Supabase infrastructure, for example Frankfurt,
          where required by the customer contract.
        </p>
      </section>

      <section className="rounded-lg border border-danger-500/20 bg-white p-5">
        <h2 className="text-h2 text-danger-700">Delete organization data</h2>
        <p className="mt-1 max-w-2xl text-body text-neutral-500">
          This deletes Findr data for this organization: deals, calls, risk
          scores, loss analysis, alerts, and integration metadata. The Clerk
          organization and user accounts are not deleted.
        </p>

        <div className="mt-5 max-w-md">
          <label
            htmlFor="delete-confirmation"
            className="mb-1.5 block text-body-strong text-neutral-900"
          >
            Type "{organizationName}" to confirm
          </label>
          <input
            id="delete-confirmation"
            value={confirmationName}
            onChange={(event) => setConfirmationName(event.target.value)}
            disabled={!isAdmin || deleting}
            className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors disabled:bg-neutral-50 disabled:text-neutral-500 focus:border-danger-500 focus:ring-2 focus:ring-danger-500/10"
          />
        </div>

        <button
          type="button"
          onClick={handleDelete}
          disabled={!isAdmin || deleting || confirmationName !== organizationName}
          className="mt-4 inline-flex h-8 items-center justify-center rounded-md bg-danger-500 px-3 text-body-strong font-medium text-white transition-colors hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete organization data"}
        </button>

        {message && <p className="mt-3 text-small text-neutral-500">{message}</p>}
        {!isAdmin && (
          <p className="mt-3 text-small text-neutral-500">
            Only organization admins can delete organization data.
          </p>
        )}
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAuth, useOrganization } from "@clerk/nextjs";
import { isAdminRole } from "@/lib/settings/roles";

export function OrganizationSettingsForm() {
  const { orgRole } = useAuth();
  const { isLoaded, organization } = useOrganization();
  const isAdmin = isAdminRole(orgRole);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (organization?.name) setName(organization.name);
  }, [organization?.name]);

  async function handleSave() {
    if (!organization || !name.trim()) return;
    setSaving(true);
    setFeedback(null);

    try {
      const updated = await organization.update({ name: name.trim() });
      await fetch("/api/onboarding/sync-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerk_org_id: updated.id,
          name: updated.name,
        }),
      });
      setFeedback("Organization updated.");
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Could not update organization.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-5 text-body text-neutral-500">
        Loading organization...
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-5 text-body text-neutral-500">
        No active organization selected.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-5">
          <h2 className="text-h2 text-neutral-900">Organization profile</h2>
          <p className="mt-1 text-body text-neutral-500">
            Manage the workspace name your team sees across Findr.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="org-name"
              className="mb-1.5 block text-body-strong text-neutral-900"
            >
              Organization name
            </label>
            <input
              id="org-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!isAdmin || saving}
              className="h-9 w-full max-w-md rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors disabled:bg-neutral-50 disabled:text-neutral-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
            />
            {!isAdmin && (
              <p className="mt-2 text-small text-neutral-500">
                Only organization admins can change this.
              </p>
            )}
          </div>

          <div className="grid gap-3 text-small text-neutral-500 md:grid-cols-2">
            <div>
              <div className="text-caption uppercase tracking-wider text-neutral-400">
                Clerk organization ID
              </div>
              <div className="mt-1 break-all text-neutral-700">
                {organization.id}
              </div>
            </div>
            <div>
              <div className="text-caption uppercase tracking-wider text-neutral-400">
                Created
              </div>
              <div className="mt-1 text-neutral-700">
                {organization.createdAt.toLocaleDateString("de-DE")}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-small text-neutral-500">
            Logo upload is managed by Clerk and can be enabled later when brand
            customization becomes part of the customer workflow.
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="inline-flex h-8 items-center justify-center rounded-md bg-primary-600 px-3 text-body-strong font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          )}

          {feedback && <p className="text-small text-neutral-500">{feedback}</p>}
        </div>
      </div>
    </div>
  );
}

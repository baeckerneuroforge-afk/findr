"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useOrganizationList, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export function CreateOrganizationForm() {
  const router = useRouter();
  const { isLoaded, createOrganization, setActive } = useOrganizationList();
  const { user, isLoaded: isUserLoaded } = useUser();

  const [orgName, setOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isUserLoaded || orgName) return;
    setOrgName(user?.firstName ? `${user.firstName}'s Workspace` : "");
  }, [isUserLoaded, orgName, user?.firstName]);

  if (!isLoaded || !createOrganization || !setActive) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center text-body text-neutral-500">
        Loading…
      </div>
    );
  }

  const createClerkOrganization = createOrganization;
  const setActiveOrganization = setActive;

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!orgName.trim()) {
      setError("Organization name is required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const clerkOrg = await createClerkOrganization({ name: orgName.trim() });

      await setActiveOrganization({ organization: clerkOrg.id });

      const syncResponse = await fetch("/api/onboarding/sync-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerk_org_id: clerkOrg.id,
          name: clerkOrg.name,
        }),
      });

      if (!syncResponse.ok) {
        const data = (await syncResponse.json()) as { error?: string };
        throw new Error(data.error || "Failed to sync org to backend");
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create organization",
      );
      setCreating(false);
    }
  }

  return (
    <form
      onSubmit={handleCreate}
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6"
    >
      <div>
        <label className="mb-1 block text-h3 text-neutral-900">
          Organization name
        </label>
        <input
          type="text"
          value={orgName}
          onChange={(event) => setOrgName(event.target.value)}
          placeholder="My Company"
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-body text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
          disabled={creating}
        />
        <p className="mt-2 text-small text-neutral-500">
          Use your company name or team name. You can change this later.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-danger-500/30 bg-danger-50 p-3 text-small text-danger-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={creating || !orgName.trim()}
        className="inline-flex h-9 w-full items-center justify-center rounded-md bg-neutral-900 px-3 text-body-strong font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {creating ? "Creating…" : "Create organization"}
      </button>
    </form>
  );
}

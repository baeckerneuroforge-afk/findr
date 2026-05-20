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
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-mist/50">
        Loading...
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
      className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6"
    >
      <div>
        <label className="mb-2 block text-sm font-medium text-white">
          Organization name
        </label>
        <input
          type="text"
          value={orgName}
          onChange={(event) => setOrgName(event.target.value)}
          placeholder="My Company"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none placeholder:text-mist/30 focus:border-violet-500/40"
          disabled={creating}
        />
        <p className="mt-2 text-xs text-mist/50">
          Use your company name or team name. You can change this later.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={creating || !orgName.trim()}
        className="w-full rounded-lg bg-violet-500 px-5 py-2.5 font-medium text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {creating ? "Creating..." : "Create organization"}
      </button>
    </form>
  );
}

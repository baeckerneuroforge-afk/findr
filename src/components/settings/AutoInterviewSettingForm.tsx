"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { isAdminRole } from "@/lib/settings/roles";

/**
 * Org-level toggle: automatically start + invite the post-loss interview when a
 * deal is marked lost. Saves immediately on toggle via /api/settings/organization
 * (org-scoped). Mirrors the slack preferences toggle pattern.
 */
export function AutoInterviewSettingForm() {
  const { orgRole } = useAuth();
  const isAdmin = isAdminRole(orgRole);

  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/organization")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.settings) {
          setEnabled(Boolean(data.settings.autoStartPostLossInterview));
        }
      })
      .catch(() => {
        /* keep default (off) on read failure */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function toggle(next: boolean) {
    if (!isAdmin || saving) return;
    const previous = enabled;
    setEnabled(next);
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/settings/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoStartPostLossInterview: next }),
      });
      if (!res.ok) throw new Error("save failed");
      setFeedback("Saved.");
    } catch {
      setEnabled(previous);
      setFeedback("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="mb-5">
        <h2 className="text-h2 text-neutral-900">Post-loss interviews</h2>
        <p className="mt-1 text-body text-neutral-500">
          Automate the post-loss feedback flow when a deal is marked lost.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-100 p-3">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!isAdmin || loading || saving}
          onChange={(e) => toggle(e.target.checked)}
          className="mt-1 accent-primary-500"
        />
        <span>
          <span className="block text-body-strong text-neutral-900">
            Automatically start and invite post-loss interviews
          </span>
          <span className="block text-caption text-neutral-500">
            When enabled, marking a deal as lost automatically creates an
            interview and emails the invitation to the contact email on the deal.
          </span>
        </span>
      </label>

      {!isAdmin && (
        <p className="mt-2 text-small text-neutral-500">
          Only organization admins can change this.
        </p>
      )}
      {feedback && <p className="mt-2 text-small text-neutral-500">{feedback}</p>}
    </div>
  );
}

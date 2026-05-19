"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { SlackIntegration } from "@/lib/slack/service";

interface SlackSettingsFormProps {
  initialIntegration: SlackIntegration | null;
}

export function SlackSettingsForm({
  initialIntegration,
}: SlackSettingsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const [form, setForm] = useState({
    workspace_name: initialIntegration?.workspace_name ?? "",
    channel_name: initialIntegration?.channel_name ?? "",
    channel_id: initialIntegration?.channel_id ?? "",
    webhook_url: initialIntegration?.webhook_url ?? "",
    alert_threshold: initialIntegration?.alert_threshold ?? 70,
    alert_on_critical_only: initialIntegration?.alert_on_critical_only ?? false,
    enabled: initialIntegration?.enabled ?? true,
  });

  async function handleSave() {
    setSaving(true);
    setFeedback(null);

    const res = await fetch("/api/integrations/slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = (await res.json()) as { success: boolean; error?: string };
    setSaving(false);

    if (data.success) {
      setFeedback({ type: "success", msg: "Settings saved." });
      router.refresh();
    } else {
      setFeedback({ type: "error", msg: data.error ?? "Failed to save." });
    }
  }

  async function handleTest() {
    setTesting(true);
    setFeedback(null);

    const res = await fetch("/api/integrations/slack/test", { method: "POST" });
    const data = (await res.json()) as { success: boolean; error?: string };
    setTesting(false);

    if (data.success) {
      setFeedback({
        type: "success",
        msg: "Test alert sent. Check your Slack channel.",
      });
    } else {
      setFeedback({ type: "error", msg: data.error ?? "Test failed." });
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-2">How to set up</h3>
        <ol className="text-sm text-mist/70 space-y-1 list-decimal list-inside">
          <li>Go to api.slack.com/apps → Create New App → From Scratch</li>
          <li>Add &ldquo;Incoming Webhooks&rdquo; feature, enable it</li>
          <li>
            Click &ldquo;Add New Webhook to Workspace&rdquo; → choose channel →
            Allow
          </li>
          <li>Copy the webhook URL and paste it below</li>
        </ol>
      </div>

      <div className="space-y-4">
        <Field
          label="Workspace name"
          hint="Optional, just for your reference"
        >
          <input
            type="text"
            value={form.workspace_name}
            onChange={(e) =>
              setForm({ ...form, workspace_name: e.target.value })
            }
            placeholder="My Company Slack"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-mist/30 focus:border-violet-500/40 outline-none"
          />
        </Field>

        <Field
          label="Channel name"
          hint="The Slack channel name where alerts go"
        >
          <input
            type="text"
            value={form.channel_name}
            onChange={(e) => setForm({ ...form, channel_name: e.target.value })}
            placeholder="#sales-alerts"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-mist/30 focus:border-violet-500/40 outline-none"
          />
        </Field>

        <Field
          label="Channel ID"
          hint="The unique ID, e.g. C01234ABCDE (find it in Slack channel settings)"
        >
          <input
            type="text"
            value={form.channel_id}
            onChange={(e) => setForm({ ...form, channel_id: e.target.value })}
            placeholder="C01234ABCDE"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-mist/30 focus:border-violet-500/40 outline-none"
          />
        </Field>

        <Field
          label="Webhook URL"
          hint="From Slack app settings → Incoming Webhooks"
        >
          <input
            type="password"
            value={form.webhook_url}
            onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-mist/30 focus:border-violet-500/40 outline-none font-mono text-sm"
          />
        </Field>

        <Field
          label={`Alert threshold: ${form.alert_threshold}/100`}
          hint="Send alert when risk score exceeds this value"
        >
          <input
            type="range"
            min={50}
            max={100}
            value={form.alert_threshold}
            onChange={(e) =>
              setForm({ ...form, alert_threshold: parseInt(e.target.value, 10) })
            }
            className="w-full"
            disabled={form.alert_on_critical_only}
          />
        </Field>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.alert_on_critical_only}
            onChange={(e) =>
              setForm({ ...form, alert_on_critical_only: e.target.checked })
            }
            className="mt-1"
          />
          <div>
            <div className="text-white font-medium text-sm">
              Only alert on CRITICAL risk
            </div>
            <div className="text-xs text-mist/50">
              Override the threshold, only send when risk_level = critical
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="mt-1"
          />
          <div>
            <div className="text-white font-medium text-sm">Enabled</div>
            <div className="text-xs text-mist/50">
              Toggle off to pause all alerts without losing settings
            </div>
          </div>
        </label>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-white/5 flex-wrap">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>

        <button
          type="button"
          onClick={handleTest}
          disabled={testing || !form.webhook_url}
          className="border border-violet-500/30 hover:border-violet-500/60 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {testing ? "Sending..." : "Send test alert"}
        </button>

        {feedback && (
          <span
            className={`text-sm ${
              feedback.type === "success"
                ? "text-emerald-400"
                : "text-red-400"
            }`}
          >
            {feedback.msg}
          </span>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white mb-1">
        {label}
      </label>
      {hint && <p className="text-xs text-mist/50 mb-2">{hint}</p>}
      {children}
    </div>
  );
}

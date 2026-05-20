"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { SlackIntegration } from "@/lib/slack/service";
import { SlackIntegrationConfigSchema } from "@/lib/schemas/slack";
import { Button } from "@/components/ui/Button";

interface SlackSettingsFormProps {
  initialIntegration: SlackIntegration | null;
}

const INPUT_BASE =
  "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-body text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors";

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

    const parsed = SlackIntegrationConfigSchema.safeParse(form);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const firstError = Object.entries(errors).find(
        ([, msgs]) => msgs && msgs.length > 0,
      );
      setFeedback({
        type: "error",
        msg: firstError
          ? `${firstError[0]}: ${firstError[1]?.[0]}`
          : "Invalid form data",
      });
      setSaving(false);
      return;
    }

    const res = await fetch("/api/integrations/slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
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
      <div className="rounded-lg border border-primary-100 bg-primary-50 p-5">
        <h3 className="mb-2 text-h3 text-neutral-900">How to set up</h3>
        <ol className="list-inside list-decimal space-y-1 text-body text-neutral-700">
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
            className={INPUT_BASE}
          />
        </Field>

        <Field
          label="Channel name"
          hint="The Slack channel where alerts go"
        >
          <input
            type="text"
            value={form.channel_name}
            onChange={(e) => setForm({ ...form, channel_name: e.target.value })}
            placeholder="#sales-alerts"
            className={INPUT_BASE}
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
            className={INPUT_BASE}
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
            className={`${INPUT_BASE} font-mono text-small`}
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
              setForm({
                ...form,
                alert_threshold: parseInt(e.target.value, 10),
              })
            }
            className="w-full accent-primary-500"
            disabled={form.alert_on_critical_only}
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={form.alert_on_critical_only}
            onChange={(e) =>
              setForm({ ...form, alert_on_critical_only: e.target.checked })
            }
            className="mt-1 accent-primary-500"
          />
          <div>
            <div className="text-body-strong text-neutral-900">
              Only alert on CRITICAL risk
            </div>
            <div className="text-caption text-neutral-500">
              Override the threshold; only send when risk_level = critical.
            </div>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="mt-1 accent-primary-500"
          />
          <div>
            <div className="text-body-strong text-neutral-900">Enabled</div>
            <div className="text-caption text-neutral-500">
              Toggle off to pause all alerts without losing settings.
            </div>
          </div>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-5">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save settings"}
        </Button>

        <Button
          variant="secondary"
          onClick={handleTest}
          disabled={testing || !form.webhook_url}
        >
          {testing ? "Sending…" : "Send test alert"}
        </Button>

        {feedback && (
          <span
            className={`rounded-md px-2.5 py-1 text-small font-medium ${
              feedback.type === "success"
                ? "bg-success-50 text-success-700"
                : "bg-danger-50 text-danger-700"
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
      <label className="mb-1 block text-h3 text-neutral-900">{label}</label>
      {hint && <p className="mb-2 text-small text-neutral-500">{hint}</p>}
      {children}
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AlertPreferences } from "@/lib/alerts/types";
import type { SlackIntegration } from "@/lib/slack/service";
import { SlackIntegrationConfigSchema } from "@/lib/schemas/slack";
import { Button } from "@/components/ui/Button";

interface SlackSettingsFormProps {
  initialIntegration: SlackIntegration | null;
  initialPreferences: AlertPreferences;
}

const INPUT_BASE =
  "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-body text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors";

export function SlackSettingsForm({
  initialIntegration,
  initialPreferences,
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
  const [preferences, setPreferences] = useState({
    risk_spike_enabled: initialPreferences.risk_spike_enabled,
    risk_spike_threshold: initialPreferences.risk_spike_threshold,
    champion_lost_enabled: initialPreferences.champion_lost_enabled,
    deal_lost_enabled: initialPreferences.deal_lost_enabled,
    forecast_change_enabled: initialPreferences.forecast_change_enabled,
    forecast_change_threshold: initialPreferences.forecast_change_threshold,
    quiet_hours_start: initialPreferences.quiet_hours_start ?? "",
    quiet_hours_end: initialPreferences.quiet_hours_end ?? "",
    timezone: initialPreferences.timezone,
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

    if (!data.success) {
      setSaving(false);
      setFeedback({ type: "error", msg: data.error ?? "Failed to save." });
      return;
    }

    const prefsRes = await fetch("/api/integrations/slack/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...preferences,
        quiet_hours_start: preferences.quiet_hours_start || null,
        quiet_hours_end: preferences.quiet_hours_end || null,
      }),
    });
    const prefsData = (await prefsRes.json()) as {
      success: boolean;
      error?: string;
    };

    setSaving(false);

    if (!prefsData.success) {
      setFeedback({
        type: "error",
        msg: prefsData.error ?? "Failed to save alert preferences.",
      });
      return;
    }

    setFeedback({ type: "success", msg: "Settings saved." });
    router.refresh();
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

      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <div>
          <h3 className="text-h3 text-neutral-900">Webhook configuration</h3>
          <p className="text-small text-neutral-500">
            Incoming webhook used for all Findr alerts.
          </p>
        </div>

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

      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <div>
          <h3 className="text-h3 text-neutral-900">Alert types</h3>
          <p className="text-small text-neutral-500">
            Choose which automated alerts should be sent to Slack.
          </p>
        </div>

        <ToggleRow
          label="Risk Spike"
          hint="Send when risk score jumps within a short period."
          checked={preferences.risk_spike_enabled}
          onChange={(checked) =>
            setPreferences({ ...preferences, risk_spike_enabled: checked })
          }
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={100}
              value={preferences.risk_spike_threshold}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  risk_spike_threshold: parseInt(e.target.value, 10),
                })
              }
              className="w-20 rounded-md border border-neutral-200 px-2 py-1 text-small text-neutral-900"
            />
            <span className="text-small text-neutral-500">points</span>
          </div>
        </ToggleRow>

        <ToggleRow
          label="Champion Lost"
          hint="Send when the Champion-Loss detector finds strong evidence."
          checked={preferences.champion_lost_enabled}
          onChange={(checked) =>
            setPreferences({ ...preferences, champion_lost_enabled: checked })
          }
        />

        <ToggleRow
          label="Deal Lost"
          hint="Send when a synced CRM deal changes to Closed-Lost."
          checked={preferences.deal_lost_enabled}
          onChange={(checked) =>
            setPreferences({ ...preferences, deal_lost_enabled: checked })
          }
        />

        <ToggleRow
          label="Forecast Change"
          hint="Send when risk-adjusted pipeline value moves materially."
          checked={preferences.forecast_change_enabled}
          onChange={(checked) =>
            setPreferences({ ...preferences, forecast_change_enabled: checked })
          }
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={100}
              value={preferences.forecast_change_threshold}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  forecast_change_threshold: parseFloat(e.target.value),
                })
              }
              className="w-20 rounded-md border border-neutral-200 px-2 py-1 text-small text-neutral-900"
            />
            <span className="text-small text-neutral-500">%</span>
          </div>
        </ToggleRow>
      </div>

      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <div>
          <h3 className="text-h3 text-neutral-900">Quiet hours</h3>
          <p className="text-small text-neutral-500">
            Optional pause window for non-urgent Slack noise.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Start">
            <input
              type="time"
              value={preferences.quiet_hours_start}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  quiet_hours_start: e.target.value,
                })
              }
              className={INPUT_BASE}
            />
          </Field>

          <Field label="End">
            <input
              type="time"
              value={preferences.quiet_hours_end}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  quiet_hours_end: e.target.value,
                })
              }
              className={INPUT_BASE}
            />
          </Field>

          <Field label="Timezone">
            <input
              type="text"
              value={preferences.timezone}
              onChange={(e) =>
                setPreferences({ ...preferences, timezone: e.target.value })
              }
              className={INPUT_BASE}
            />
          </Field>
        </div>
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

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  children,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-neutral-100 p-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 accent-primary-500"
        />
        <div>
          <div className="text-body-strong text-neutral-900">{label}</div>
          <div className="text-caption text-neutral-500">{hint}</div>
        </div>
      </label>
      {children}
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

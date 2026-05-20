import { z } from "zod";

export type AlertType =
  | "risk_spike"
  | "champion_lost"
  | "deal_lost"
  | "forecast_change";

export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertContext {
  org_id: string;
  deal_id?: string;
  deal_name?: string;
  deal_amount?: number;
  deal_owner?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertPayload {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  body: string;
  context: AlertContext;
}

export const AlertPreferencesSchema = z.object({
  risk_spike_enabled: z.boolean().default(true),
  risk_spike_threshold: z.number().int().min(1).max(100).default(25),
  champion_lost_enabled: z.boolean().default(true),
  deal_lost_enabled: z.boolean().default(true),
  forecast_change_enabled: z.boolean().default(true),
  forecast_change_threshold: z.number().min(1).max(100).default(20),
  quiet_hours_start: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .default(null),
  quiet_hours_end: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .default(null),
  timezone: z.string().min(1).max(100).default("Europe/Berlin"),
});

export type AlertPreferencesInput = z.infer<typeof AlertPreferencesSchema>;

export interface AlertPreferences extends AlertPreferencesInput {
  org_id: string;
}

export interface AlertHistoryItem {
  id: string;
  org_id: string;
  alert_type: AlertType;
  deal_id: string | null;
  severity: AlertSeverity;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  sent_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  snoozed_until: string | null;
}

import Link from "next/link";
import { getLocale } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import type { AlertHistoryItem, AlertSeverity, AlertType } from "@/lib/alerts/types";

interface AlertHistoryPanelProps {
  alerts: AlertHistoryItem[];
}

const TYPE_LABELS: Record<AlertType, string> = {
  risk_spike: "Risk Spike",
  champion_lost: "Champion Lost",
  deal_lost: "Deal Lost",
  forecast_change: "Forecast Change",
};

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  info: "bg-primary-50 text-primary-700",
  warning: "bg-warning-50 text-warning-700",
  critical: "bg-danger-50 text-danger-700",
};

export async function AlertHistoryPanel({ alerts }: AlertHistoryPanelProps) {
  const locale = await getLocale();
  return (
    <div className="rounded-lg border border-neutral-200 bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-h3 text-neutral-900">Alert history</h3>
          <p className="text-small text-neutral-500">
            Last 20 Slack alerts sent by Klymeo.
          </p>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-200 p-6 text-center text-body text-neutral-500">
          No Slack alerts sent yet.
        </div>
      ) : (
        <div className="divide-y divide-neutral-100">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="grid gap-3 py-3 md:grid-cols-[140px_1fr_auto]"
            >
              <div className="text-small text-neutral-500">
                {new Date(alert.sent_at).toLocaleString(toBcp47(locale), {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body-strong text-neutral-900">
                    {alert.title}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-caption font-medium ${SEVERITY_STYLES[alert.severity]}`}
                  >
                    {alert.severity}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-medium text-neutral-600">
                    {TYPE_LABELS[alert.alert_type]}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-small text-neutral-500">
                  {alert.body}
                </p>
              </div>

              <div className="flex items-center gap-3 text-small">
                <span
                  className={
                    alert.acknowledged_at
                      ? "text-success-700"
                      : alert.snoozed_until
                        ? "text-warning-700"
                        : "text-neutral-500"
                  }
                >
                  {alert.acknowledged_at
                    ? "Acknowledged"
                    : alert.snoozed_until
                      ? "Snoozed"
                      : "Sent"}
                </span>
                {alert.deal_id && (
                  <Link
                    href={`/dashboard/deals/${alert.deal_id}`}
                    className="text-primary-700 hover:text-primary-900"
                  >
                    View deal
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

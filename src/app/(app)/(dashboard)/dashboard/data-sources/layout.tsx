import { ScopedMessages } from "@/components/i18n/ScopedMessages";

/**
 * i18n-Sektions-Provider (Perf-Split, siehe src/i18n/client-messages.ts):
 * "sales" für die Risk-/Signal-Komponenten, die der manuelle Import-Flow
 * (data-sources/manual) transitiv mountet (RiskSignalDrilldown).
 */
export default function DataSourcesMessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ScopedMessages namespaces={["sales"]}>{children}</ScopedMessages>;
}

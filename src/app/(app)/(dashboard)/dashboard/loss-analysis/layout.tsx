import { ScopedMessages } from "@/components/i18n/ScopedMessages";

/**
 * i18n-Sektions-Provider (Perf-Split, siehe src/i18n/client-messages.ts):
 * stellt den Client-Komponenten dieser Sektion ihre schweren Namespaces
 * bereit — der (app)-Root liefert nur noch den Shell-Kern.
 */
export default function LossAnalysisMessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ScopedMessages namespaces={["sales"]}>{children}</ScopedMessages>;
}

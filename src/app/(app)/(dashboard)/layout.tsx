import { auth } from "@/auth";
import { ShellFrame } from "@/components/dashboard/ShellFrame";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeShell } from "@/components/theme/ThemeShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Identity for the header chrome comes from the Zitadel session (org name +
  // signed-in user); proxy.ts has already gated this subtree to logged-in users.
  const session = await auth();
  // ThemeShell rendert den bisherigen Shell-Wrapper (font-body, bg-surface,
  // Textfarbe) und trägt die .dark-Klasse fürs Dashboard — Routen außerhalb
  // dieses Layouts bleiben konstruktiv hell. Sie liegt bewusst AUSSEN um den
  // ToastProvider: dessen fixed-Viewport rendert als Geschwister der Children
  // und muss die .dark-Variablen erben (der Shell-Div hat keinen transform —
  // position:fixed bleibt am Fenster verankert, die template.tsx-Regel aus
  // dem Toast-Kommentar gilt weiter).
  //
  // E3: Sidebar + Hauptspalte ziehen in den Client-Wrapper ShellFrame um, der
  // den kollabierbaren Zustand hält (localStorage) und das Links-Padding der
  // Spalte mit der Sidebar-Breite synchronisiert. Dieses Layout bleibt ein
  // Server-Component: es holt nur die Session und reicht Identität + children
  // weiter (Header/Main rendert jetzt ShellFrame, identisch zu vorher).
  return (
    <ThemeShell>
      <ToastProvider>
        <ShellFrame
          orgName={session?.user?.orgName ?? null}
          userName={session?.user?.name ?? null}
          userEmail={session?.user?.email ?? null}
        >
          {children}
        </ShellFrame>
      </ToastProvider>
    </ThemeShell>
  );
}

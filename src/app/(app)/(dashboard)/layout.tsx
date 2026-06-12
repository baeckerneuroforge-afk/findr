import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeShell } from "@/components/theme/ThemeShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ThemeShell rendert den bisherigen Shell-Wrapper (font-body, bg-surface,
  // Textfarbe) und trägt die .dark-Klasse fürs Dashboard — Routen außerhalb
  // dieses Layouts bleiben konstruktiv hell. Sie liegt bewusst AUSSEN um den
  // ToastProvider: dessen fixed-Viewport rendert als Geschwister der Children
  // und muss die .dark-Variablen erben (der Shell-Div hat keinen transform —
  // position:fixed bleibt am Fenster verankert, die template.tsx-Regel aus
  // dem Toast-Kommentar gilt weiter).
  return (
    <ThemeShell>
      <ToastProvider>
        <DashboardSidebar />
        <div className="pl-60">
          <DashboardHeader />
          {/* 1120px-Mittelspalte (v5-Mockup .content-inner): die ruhige,
              fokussierte Lesespalte ist der größte Einzelhebel für den
              aufgeräumten Eindruck — vorher 1400px, auf denen sich die
              Karten zerdehnten. */}
          <main className="px-8 py-8 max-w-[1120px] mx-auto">{children}</main>
        </div>
      </ToastProvider>
    </ThemeShell>
  );
}

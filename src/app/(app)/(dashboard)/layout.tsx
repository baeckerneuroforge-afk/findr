import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { ToastProvider } from "@/components/ui/Toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div
        className="font-body min-h-screen bg-neutral-50 text-neutral-700"
      >
        <DashboardSidebar />
        <div className="pl-60">
          <DashboardHeader />
          {/* 1120px-Mittelspalte (v5-Mockup .content-inner): die ruhige,
              fokussierte Lesespalte ist der größte Einzelhebel für den
              aufgeräumten Eindruck — vorher 1400px, auf denen sich die
              Karten zerdehnten. */}
          <main className="px-8 py-8 max-w-[1120px] mx-auto">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

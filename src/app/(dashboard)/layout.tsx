import { GeistSans } from "geist/font/sans";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${GeistSans.className} min-h-screen bg-neutral-50 text-neutral-700`}
    >
      <DashboardSidebar />
      <div className="pl-60">
        <DashboardHeader />
        <main className="px-8 py-8 max-w-[1400px] mx-auto">{children}</main>
      </div>
    </div>
  );
}

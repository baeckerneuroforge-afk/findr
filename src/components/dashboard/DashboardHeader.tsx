"use client";

import { UserButton } from "@clerk/nextjs";
import { OrgDisplay } from "@/components/dashboard/OrgDisplay";

export default function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-neutral-200 px-6 flex items-center justify-between">
      <div className="flex items-center">
        <OrgDisplay />
      </div>
      <div className="flex items-center gap-3">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
            },
          }}
        />
      </div>
    </header>
  );
}

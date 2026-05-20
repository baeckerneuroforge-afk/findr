"use client";

import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";

export default function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-neutral-200 px-6 flex items-center justify-between">
      <div className="flex items-center">
        <OrganizationSwitcher
          hidePersonal={false}
          afterCreateOrganizationUrl="/dashboard"
          afterSelectOrganizationUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: "flex items-center",
              organizationSwitcherTrigger:
                "px-2 py-1 hover:bg-neutral-50 rounded-md text-body text-neutral-900",
            },
          }}
        />
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

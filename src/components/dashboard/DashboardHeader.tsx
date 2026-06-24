"use client";

import { OrgDisplay } from "@/components/dashboard/OrgDisplay";
import { SearchHeaderWidget } from "@/components/search/SearchHeaderWidget";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { UserMenu } from "@/components/dashboard/UserMenu";

export default function DashboardHeader({
  orgName,
  userName,
  userEmail,
}: {
  orgName: string | null;
  userName: string | null;
  userEmail: string | null;
}) {
  // 3-column grid (1fr / auto / 1fr) so the search widget sits at the true
  // viewport center regardless of OrgDisplay text length or the avatar size;
  // flex + justify-between would float the widget at the midpoint of available
  // space, which drifts as the sides resize.
  return (
    <header className="sticky top-0 z-30 grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-neutral-200 bg-card px-6">
      <div className="flex items-center">
        <OrgDisplay orgName={orgName} />
      </div>
      <SearchHeaderWidget />
      <div className="flex items-center justify-self-end gap-3">
        <ThemeSwitcher variant="header" />
        <LanguageSwitcher variant="header" />
        <UserMenu name={userName} email={userEmail} />
      </div>
    </header>
  );
}

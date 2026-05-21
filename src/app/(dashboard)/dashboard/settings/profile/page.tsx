import { UserProfile } from "@clerk/nextjs";
import { findrDashboardClerkAppearance } from "@/lib/clerk/dashboard-appearance";

export default function ProfileSettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-h2 text-neutral-900">Profile</h2>
        <p className="mt-1 text-body text-neutral-500">
          Update your name, email addresses, password, and security settings.
        </p>
      </div>
      <UserProfile
        routing="hash"
        appearance={findrDashboardClerkAppearance}
      />
    </div>
  );
}

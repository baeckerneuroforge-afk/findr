import { OrganizationSettingsForm } from "@/components/settings/OrganizationSettingsForm";
import { AutoInterviewSettingForm } from "@/components/settings/AutoInterviewSettingForm";

export default function OrganizationSettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-h2 text-neutral-900">Organization</h2>
        <p className="mt-1 text-body text-neutral-500">
          Workspace identity and support details.
        </p>
      </div>
      <OrganizationSettingsForm />
      <AutoInterviewSettingForm />
    </div>
  );
}

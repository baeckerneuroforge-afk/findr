import { OrganizationSettingsForm } from "@/components/settings/OrganizationSettingsForm";

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
    </div>
  );
}

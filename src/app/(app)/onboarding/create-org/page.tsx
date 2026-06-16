import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CreateOrganizationForm } from "@/components/onboarding/CreateOrganizationForm";
import { KlymeoMark } from "@/components/shared/KlymeoMark";

export default async function CreateOrgPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (orgId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-5 flex justify-center">
            <KlymeoMark className="h-10 w-10" />
          </div>
          <h1 className="text-display text-neutral-900 mb-2">
            Welcome to Klymeo
          </h1>
          <p className="text-body text-neutral-500">
            Create your organization to get started. This is your team&apos;s
            workspace in Klymeo.
          </p>
        </div>

        <CreateOrganizationForm />

        <p className="mt-6 text-center text-small text-neutral-400">
          You can invite team members later.
        </p>
      </div>
    </div>
  );
}

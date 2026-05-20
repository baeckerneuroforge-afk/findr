import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CreateOrganizationForm } from "@/components/onboarding/CreateOrganizationForm";

export default async function CreateOrgPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (orgId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-obsidian p-6 text-white">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-white">
            Welcome to Findr
          </h1>
          <p className="text-sm text-mist/70">
            Create your organization to get started. This is your team&apos;s
            workspace in Findr.
          </p>
        </div>

        <CreateOrganizationForm />

        <p className="mt-6 text-center text-xs text-mist/40">
          You can invite team members later.
        </p>
      </div>
    </div>
  );
}

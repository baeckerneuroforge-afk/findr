import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { findrAuthAppearance } from "@/lib/clerk/appearance";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" aria-label="Findr home" className="mb-8 inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Findr" className="h-[30px] w-auto" />
      </Link>

      <SignUp
        appearance={findrAuthAppearance}
        fallbackRedirectUrl="/onboarding/create-org"
        signInFallbackRedirectUrl="/dashboard"
      />

      <p className="mt-8 text-sm text-mist">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="text-violet-400 transition-colors hover:text-violet-300"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { klymeoAuthAppearance } from "@/lib/clerk/appearance";
import { KlymeoMark } from "@/components/shared/KlymeoMark";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link
        href="/"
        aria-label="Klymeo home"
        className="mb-8 inline-flex items-center gap-2"
      >
        <KlymeoMark tone="onDark" className="h-8 w-8" />
        <span
          className="text-2xl text-white"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            letterSpacing: "-0.04em",
          }}
        >
          Klymeo
        </span>
      </Link>

      <SignUp
        appearance={klymeoAuthAppearance}
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

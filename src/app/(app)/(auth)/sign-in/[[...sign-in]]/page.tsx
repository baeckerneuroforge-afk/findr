import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { klymeoAuthAppearance } from "@/lib/clerk/appearance";
import { KlymeoMark } from "@/components/shared/KlymeoMark";

export default function SignInPage() {
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

      <SignIn
        appearance={klymeoAuthAppearance}
        fallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/onboarding/create-org"
      />

      <p className="mt-8 text-sm text-mist">
        Don&rsquo;t have an account?{" "}
        <Link
          href="/sign-up"
          className="text-violet-400 transition-colors hover:text-violet-300"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}

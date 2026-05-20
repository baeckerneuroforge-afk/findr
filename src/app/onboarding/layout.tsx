import { GeistSans } from "geist/font/sans";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${GeistSans.className} min-h-screen bg-neutral-50 text-neutral-700`}
    >
      {children}
    </div>
  );
}

import type { Metadata } from "next";
import { Navbar } from "@/components/landing-comic/Navbar";
import { Hero } from "@/components/landing-comic/Hero";
import { PlatformArchitecture } from "@/components/landing-comic/PlatformArchitecture";
import { Modules } from "@/components/landing-comic/Modules";
import { WhyWedges } from "@/components/landing-comic/WhyWedges";
import { LearnsOverTime } from "@/components/landing-comic/LearnsOverTime";
import { FinalCta } from "@/components/landing-comic/FinalCta";
import { Footer } from "@/components/landing-comic/Footer";

export const metadata: Metadata = {
  title: "Findr — One AI brain. Four products. Zero data silos.",
  description:
    "Findr reads every customer conversation and turns it into decisions — at the speed of decision. EU-hosted, GDPR + EU AI Act compliant.",
};

export default function ComicLandingPage() {
  return (
    <main className="font-grotesk bg-paper text-ink min-h-screen relative overflow-x-hidden">
      {/* paper grain dots behind everything */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] comic-dots" />
      <div className="relative z-10">
        <Navbar />
        <Hero />
        <PlatformArchitecture />
        <Modules />
        <WhyWedges />
        <LearnsOverTime />
        <FinalCta />
        <Footer />
      </div>
    </main>
  );
}

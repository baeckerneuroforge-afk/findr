import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { PlatformVisualization } from "@/components/landing/PlatformVisualization";
import { ModuleShowcase } from "@/components/landing/ModuleShowcase";
import { WhyFindr } from "@/components/landing/WhyFindr";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-obsidian text-white overflow-x-hidden">
      <Header />
      <Hero />
      <PlatformVisualization />
      <ModuleShowcase />
      <WhyFindr />
      <HowItWorks />
      <FinalCTA />
      <LandingFooter />
    </main>
  );
}

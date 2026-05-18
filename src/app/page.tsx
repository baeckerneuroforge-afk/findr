import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import ProblemSection from "@/components/landing/ProblemSection";
import FeaturePredictiveSection from "@/components/landing/FeaturePredictiveSection";
import FeatureReactiveSection from "@/components/landing/FeatureReactiveSection";
import FeatureKnowledgeSection from "@/components/landing/FeatureKnowledgeSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import IntegrationsShowcase from "@/components/landing/IntegrationsShowcase";
import UseCasesSection from "@/components/landing/UseCasesSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import PricingTeaser from "@/components/landing/PricingTeaser";
import FinalCTASection from "@/components/landing/FinalCTASection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <ProblemSection />
        <FeaturePredictiveSection />
        <FeatureReactiveSection />
        <FeatureKnowledgeSection />
        <HowItWorksSection />
        <IntegrationsShowcase />
        <UseCasesSection />
        <TestimonialsSection />
        <PricingTeaser />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </>
  );
}

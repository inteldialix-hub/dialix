import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import StatsSection from "@/components/StatsSection";
import BellFramework from "@/components/BellFramework";
import ScrollProcessSection from "@/components/ScrollProcessSection";
import VoiceAIOS from "@/components/VoiceAIOS";
import OmnichannelSection from "@/components/OmnichannelSection";
import TelephonySection from "@/components/TelephonySection";
import IndustryAgents from "@/components/IndustryAgents";
import EnterpriseBenefits from "@/components/EnterpriseBenefits";
import IntegrationsSection from "@/components/IntegrationsSection";
import CaseStudySection from "@/components/CaseStudySection";
import TestimonialsSection from "@/components/TestimonialsSection";
import CTABanner from "@/components/CTABanner";
import FAQSection from "@/components/FAQSection";
import Footer from "@/components/Footer";
import { PageWrapper } from "@/components/PageWrapper";

export default function Home() {
  return (
    <PageWrapper>
      <Header />
      <HeroSection />
      <StatsSection />
      <BellFramework />
      <ScrollProcessSection />
      <VoiceAIOS />
      <OmnichannelSection />
      <TelephonySection />
      <IndustryAgents />
      <EnterpriseBenefits />
      <IntegrationsSection />
      <CaseStudySection />
      <TestimonialsSection />
      <CTABanner />
      <FAQSection />
      <Footer />
    </PageWrapper>
  );
}

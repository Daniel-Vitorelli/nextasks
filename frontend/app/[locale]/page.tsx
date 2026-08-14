import AboutSection from "@/components/landing/about-section";
import BenefitsSection from "@/components/landing/benefits-section";
import CallToActionSection from "@/components/landing/call-to-action-section";
import FeaturesSection from "@/components/landing/features-section";
import FooterSection from "@/components/landing/footer-section";
import HeroSection from "@/components/landing/hero-section";
import { Separator } from "@/components/ui/separator";
import { setRequestLocale } from "next-intl/server";

export default function Home({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return (
    <>
      <HeroSection />
      <Separator className="my-24 mask-[linear-gradient(to_right,transparent,black_25%,black_75%,transparent)]" />
      <AboutSection />
      <Separator className="my-24 mask-[linear-gradient(to_right,transparent,black_25%,black_75%,transparent)]" />
      <BenefitsSection />
      <Separator className="my-24 mask-[linear-gradient(to_right,transparent,black_25%,black_75%,transparent)]" />
      <FeaturesSection />
      <Separator className="my-24 mask-[linear-gradient(to_right,transparent,black_25%,black_75%,transparent)]" />
      <CallToActionSection />
      <FooterSection />
    </>
  );
}

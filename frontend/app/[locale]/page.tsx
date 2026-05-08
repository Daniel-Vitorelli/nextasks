import AboutSection from "@/components/home/aboutSection";
import BenefitsSection from "@/components/home/benefitsSection";
import CallToActionSection from "@/components/home/callToActionSection";
import FeaturesSection from "@/components/home/featuresSection";
import FooterSection from "@/components/home/footerSection";
import HeroSection from "@/components/home/heroSection";
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

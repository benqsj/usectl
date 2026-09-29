import { HeroSection } from "@/components/sections/HeroSection";
import { Footer } from "@/components/layout/Footer";
import { FooterMobile } from "@/components/mobile/FooterMobile";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <HeroSection />
      {/* The footer also supplies the trailing scroll room the hero's pin end needs (the
          "last section" trap documented in PROJECT.md — the temporary spacer lived here). */}
      <div className="max-lg:hidden">
        <Footer />
      </div>
      <FooterMobile />
    </main>
  );
}

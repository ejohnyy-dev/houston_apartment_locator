import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import { HomeMapView } from "@/components/HomeMapView";
import ServicesSection from "@/components/ServicesSection";
import HoustonSection from "@/components/HoustonSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";

export default function Home() {
  useEffect(() => {
    document.title = "Houston Apartment Locator | Free Service | Habitat";
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <section className="w-full h-96 bg-slate-900">
        <HomeMapView />
      </section>
      <ServicesSection />
      <HoustonSection />
      <HowItWorksSection />
      <ContactForm />
      <Footer />
    </div>
  );
}

import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ServicesSection from "@/components/ServicesSection";
import HoustonSection from "@/components/HoustonSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <ServicesSection />
      <HoustonSection />
      <HowItWorksSection />
      <ContactForm />
      <Footer />
    </div>
  );
}

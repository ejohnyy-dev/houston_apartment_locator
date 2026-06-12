import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ServicesSection from "@/components/ServicesSection";
import HoustonSection from "@/components/HoustonSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import { HomeMapView } from "@/components/HomeMapView";
import { QualificationPrompt, DEFAULT_NEIGHBORHOODS } from "@/components/QualificationPrompt";
import { useQualification } from "@/contexts/QualificationContext";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

function MapSection() {
  const {
    qualificationData,
    hasCompletedQuestionnaire,
    hasQualified,
    showQualificationPrompt,
    setQualificationData,
    markQualified,
    setShowQualificationPrompt,
  } = useQualification();

  return (
    <section id="map" className="py-16 md:py-24 bg-background">
      <QualificationPrompt
        isOpen={showQualificationPrompt && !hasQualified}
        neighborhoods={DEFAULT_NEIGHBORHOODS}
        initialData={hasCompletedQuestionnaire ? qualificationData : null}
        onComplete={(data) => {
          setQualificationData(data);
          markQualified();
          setShowQualificationPrompt(false);
        }}
      />
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Explore Houston Apartments
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Browse curated communities across the Houston area. Tell us what
            you're looking for and we'll match you with the right place — at
            no cost to you.
          </p>
        </div>
        <div className="h-[480px] rounded-lg overflow-hidden border">
          <HomeMapView />
        </div>
        <div className="text-center mt-6">
          <Link href="/search">
            <Button size="lg">Search All Listings</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <ServicesSection />
      <MapSection />
      <HoustonSection />
      <HowItWorksSection />
      <ContactForm />
      <Footer />
    </div>
  );
}

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";
import { MapSearchFilter, type MapFilters } from "@/components/MapSearchFilter";
import { InquiryForm } from "@/components/InquiryForm";
import { QualificationPrompt } from "@/components/QualificationPrompt";
import { useFavorites } from "@/hooks/useFavorites";
import { useQualification } from "@/contexts/QualificationContext";

export default function Home() {
  const { favorites } = useFavorites();
  const { showQualificationPrompt, setShowQualificationPrompt, setQualificationData } = useQualification();
  const neighborhoods = ["Midtown", "Downtown", "Upper Kirby", "Montrose", "Galleria Area", "Heights", "Westchase", "Uptown", "Memorial", "Bellaire", "Sugar Land", "The Woodlands", "Katy", "Pearland"];
  const [mapFilters, setMapFilters] = useState<MapFilters>({
    searchText: "",
    minBedrooms: null,
    maxBedrooms: null,
    minRent: null,
    maxRent: null,
  });
  const [inquiryForm, setInquiryForm] = useState<{
    apartmentId: string;
    apartmentName: string;
  } | null>(null);

  useEffect(() => {
    document.title = "Houston Apartment Locator | Free Service | Habitat";
  }, []);

  useEffect(() => {
    const handleInquiry = (event: Event) => {
      const customEvent = event as CustomEvent;
      setInquiryForm({
        apartmentId: customEvent.detail.apartmentId,
        apartmentName: customEvent.detail.apartmentName,
      });
    };

    window.addEventListener("apartmentInquiry", handleInquiry);
    return () => window.removeEventListener("apartmentInquiry", handleInquiry);
  }, []);

  return (
    <div className="min-h-screen">
      <QualificationPrompt
        isOpen={showQualificationPrompt}
        neighborhoods={neighborhoods}
        onComplete={(data) => {
          setQualificationData(data);
        }}
      />
      <Navbar />
      <HeroSection mapFilters={mapFilters} onFilterChange={setMapFilters} />
      
      {/* Why Choose Us Section */}
      <section className="py-16 bg-dark border-t border-white/5">
        <div className="container">
          <h2 className="text-3xl sm:text-4xl font-semibold text-white mb-12 text-center">
            Why Choose Habitat Apartment Locators
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-lg font-semibold text-white mb-2">Expert Matching</h3>
              <p className="text-white/60 text-sm">We understand Houston's diverse neighborhoods and find apartments that match your lifestyle and budget perfectly.</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-lg font-semibold text-white mb-2">100% Free Service</h3>
              <p className="text-white/60 text-sm">No hidden fees, no commissions charged to you. We negotiate deals and get you move-in specials at no cost.</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-lg font-semibold text-white mb-2">Fast & Easy</h3>
              <p className="text-white/60 text-sm">Browse 530+ apartments on our interactive map, filter by your preferences, and get connected to landlords quickly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-dark/50">
        <div className="container">
          <h2 className="text-3xl sm:text-4xl font-semibold text-white mb-12 text-center">
            How Our Service Works
          </h2>
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gold text-dark flex items-center justify-center font-bold">1</div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Search & Filter</h3>
                <p className="text-white/60">Use our interactive map to browse 530+ available apartments in Houston. Filter by neighborhood, bedrooms, and rent price.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gold text-dark flex items-center justify-center font-bold">2</div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Request Details</h3>
                <p className="text-white/60">Click "See Full Property Details" on any apartment and sign up with your contact information. We'll reach out with the full address and landlord contact.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gold text-dark flex items-center justify-center font-bold">3</div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">We Negotiate</h3>
                <p className="text-white/60">We contact landlords on your behalf, negotiate move-in specials, and handle all the details so you don't have to.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gold text-dark flex items-center justify-center font-bold">4</div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Move In</h3>
                <p className="text-white/60">We guide you through the entire process from lease signing to move-in day. Your perfect Houston apartment awaits!</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      {inquiryForm && (
        <InquiryForm
          apartmentId={inquiryForm.apartmentId}
          apartmentName={inquiryForm.apartmentName}
          favorites={favorites}
          onClose={() => setInquiryForm(null)}
        />
      )}
    </div>
  );
}

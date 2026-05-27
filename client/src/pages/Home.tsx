import { useEffect } from "react";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";
import { MapSearchFilter, type MapFilters } from "@/components/MapSearchFilter";
import { InquiryForm } from "@/components/InquiryForm";

export default function Home() {
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
      <Navbar />
      <HeroSection mapFilters={mapFilters} onFilterChange={setMapFilters} />
      <Footer />
      {inquiryForm && (
        <InquiryForm
          apartmentId={inquiryForm.apartmentId}
          apartmentName={inquiryForm.apartmentName}
          onClose={() => setInquiryForm(null)}
        />
      )}
    </div>
  );
}

import { useEffect } from "react";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";
import { MapSearchFilter, type MapFilters } from "@/components/MapSearchFilter";

export default function Home() {
  const [mapFilters, setMapFilters] = useState<MapFilters>({
    searchText: "",
    minBedrooms: null,
    maxBedrooms: null,
    minRent: null,
    maxRent: null,
  });

  useEffect(() => {
    document.title = "Houston Apartment Locator | Free Service | Habitat";
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection mapFilters={mapFilters} onFilterChange={setMapFilters} />
      <Footer />
    </div>
  );
}

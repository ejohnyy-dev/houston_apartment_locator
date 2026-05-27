import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import { HomeMapView } from "@/components/HomeMapView";
import Footer from "@/components/Footer";

export default function Home() {
  useEffect(() => {
    document.title = "Houston Apartment Locator | Free Service | Habitat";
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <section className="w-full py-12 px-4 bg-gradient-to-b from-slate-900 to-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Explore Apartments on the Map</h2>
            <p className="text-gray-300">Click on any marker to see apartment details and pricing</p>
          </div>
          <div className="rounded-xl overflow-hidden shadow-2xl border border-gold/20 h-96 bg-slate-800">
            <HomeMapView className="rounded-lg" />
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

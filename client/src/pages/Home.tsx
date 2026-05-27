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
      <section className="w-full h-96 bg-slate-900">
        <HomeMapView />
      </section>
      <Footer />
    </div>
  );
}

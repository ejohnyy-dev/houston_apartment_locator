import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";

export default function Home() {
  useEffect(() => {
    document.title = "Houston Apartment Locator | Free Service | Habitat";
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <Footer />
    </div>
  );
}

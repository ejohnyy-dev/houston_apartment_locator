import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import HoustonSection from '@/components/HoustonSection';
import ContactForm from '@/components/ContactForm';
import Footer from '@/components/Footer';

export default function HoustonPage() {
  useEffect(() => {
    document.title = 'About Houston | Houston Apartment Locator';
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-20">
        <HoustonSection />
      </div>
      <ContactForm />
      <Footer />
    </div>
  );
}

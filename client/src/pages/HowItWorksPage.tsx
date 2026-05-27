import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import HowItWorksSection from '@/components/HowItWorksSection';
import ContactForm from '@/components/ContactForm';
import Footer from '@/components/Footer';

export default function HowItWorksPage() {
  useEffect(() => {
    document.title = 'How It Works | Houston Apartment Locator';
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-20">
        <HowItWorksSection />
      </div>
      <ContactForm />
      <Footer />
    </div>
  );
}

import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Breadcrumb from '@/components/Breadcrumb';
import HowItWorksSection from '@/components/HowItWorksSection';
import ContactForm from '@/components/ContactForm';
import Footer from '@/components/Footer';
import { useBreadcrumbSchema } from '@/hooks/useBreadcrumbSchema';

export default function HowItWorksPage() {
  useBreadcrumbSchema([{ label: 'How It Works', href: '/how-it-works' }]);
  useEffect(() => {
    document.title = 'How It Works | Houston Apartment Locator';
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <Breadcrumb items={[{ label: 'How It Works', href: '/how-it-works' }]} />
      <div className="pt-20">
        <HowItWorksSection />
      </div>
      <ContactForm />
      <Footer />
    </div>
  );
}

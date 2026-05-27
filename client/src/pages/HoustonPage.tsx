import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Breadcrumb from '@/components/Breadcrumb';
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
      <Breadcrumb items={[{ label: 'Houston', href: '/houston' }]} />
      <div className="pt-20">
        <HoustonSection />
      </div>
      <ContactForm />
      <Footer />
    </div>
  );
}

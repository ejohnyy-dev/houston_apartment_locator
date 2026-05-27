import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Breadcrumb from '@/components/Breadcrumb';
import ServicesSection from '@/components/ServicesSection';
import ContactForm from '@/components/ContactForm';
import Footer from '@/components/Footer';

export default function Services() {
  useEffect(() => {
    document.title = 'Our Services | Houston Apartment Locator';
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <Breadcrumb items={[{ label: 'Services', href: '/services' }]} />
      <div className="pt-20">
        <ServicesSection />
      </div>
      <ContactForm />
      <Footer />
    </div>
  );
}

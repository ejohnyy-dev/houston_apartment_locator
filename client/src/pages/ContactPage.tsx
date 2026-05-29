import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Breadcrumb from '@/components/Breadcrumb';
import ContactForm from '@/components/ContactForm';
import Footer from '@/components/Footer';
import { useBreadcrumbSchema } from '@/hooks/useBreadcrumbSchema';

export default function ContactPage() {
  useBreadcrumbSchema([{ label: 'Contact', href: '/contact' }]);
  useEffect(() => {
    document.title = 'Contact Us | Houston Apartment Locator';
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <Breadcrumb items={[{ label: 'Contact', href: '/contact' }]} />
      <div className="pt-16">
        <ContactForm />
      </div>
      <Footer />
    </div>
  );
}

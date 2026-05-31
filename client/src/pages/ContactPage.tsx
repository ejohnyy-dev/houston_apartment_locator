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
      <div className="pt-20">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold mb-8 text-center">Get in Touch</h1>
          <p className="text-lg text-center text-slate-600 mb-12 max-w-2xl mx-auto">
            Have questions? We're here to help. Reach out to us and we'll get back to you as soon as possible.
          </p>
        </div>
        <ContactForm />
      </div>
      <Footer />
    </div>
  );
}

import { usePageMeta } from "./usePageMeta";
import { faqItems } from "./seoContent";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  usePageMeta({
    title: "Houston Apartment Locator FAQ | Common Questions | Habitat Locators",
    description:
      "Get answers to common questions about apartment hunting in Houston. Learn how our free service works and how we can help.",
    url: "https://txaptfinder.com/faq",
    jsonLd: faqJsonLd,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">Frequently Asked Questions</h1>
          <p className="text-xl text-slate-300">
            Get answers to common questions about finding apartments in Houston with Habitat Locators.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-4">
            {faqItems.map((item, idx) => (
              <div key={idx} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <button
                  onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700 transition text-left"
                >
                  <h3 className="text-lg font-semibold pr-4">{item.question}</h3>
                  <ChevronDown
                    size={24}
                    className={`flex-shrink-0 text-amber-500 transition-transform ${
                      openIndex === idx ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openIndex === idx && (
                  <div className="px-6 py-4 bg-slate-700 border-t border-slate-600">
                    <p className="text-slate-200">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Still Have Questions?</h2>
          <p className="text-lg text-slate-300 mb-8">
            Reach out to our team directly. We're here to help you find the perfect apartment.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/#contact"
              className="inline-block bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 px-8 rounded transition"
            >
              Contact Us
            </a>
            <a
              href="tel:8326037278"
              className="inline-block border-2 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-slate-900 font-bold py-3 px-8 rounded transition"
            >
              Call (832) 603-7278
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

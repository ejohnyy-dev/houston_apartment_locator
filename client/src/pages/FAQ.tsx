import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { Link } from "wouter";
import { useEffect } from "react";
import { usePageMeta } from "./usePageMeta";

const faqs = [
  {
    question: "How much does an apartment locator cost in Houston?",
    answer:
      "An apartment locator is 100% free for renters. Apartment communities pay locators a referral fee from their existing marketing budget when you sign a lease, so you do not pay for the service.",
  },
  {
    question: "How do apartment locators get paid?",
    answer:
      "Apartment locators are paid by the apartment community after a renter signs a lease and lists the locator as the referral source. The rent you pay is the same whether you use a locator or search alone.",
  },
  {
    question: "What credit score do I need to rent an apartment in Houston?",
    answer:
      "Many Houston apartments prefer a credit score around 600 or higher for standard approval, but some communities work with lower scores, higher deposits, co-signers, or second-chance programs.",
  },
  {
    question: "Can an apartment locator help with a broken lease?",
    answer:
      "Yes. A broken lease does not automatically end your apartment search. Some Houston communities offer second-chance leasing options, often with extra deposit requirements or tighter approval conditions.",
  },
  {
    question: "What areas of Houston do you cover?",
    answer:
      "I help renters across Houston, including Downtown, Midtown, The Heights, Montrose, Museum District, Galleria, Medical Center, Energy Corridor, Katy, Sugar Land, The Woodlands, Spring, Clear Lake, Pearland, and nearby areas.",
  },
  {
    question: "How fast can you send apartment options?",
    answer:
      "For most renters, I can send a useful shortlist within 24 to 48 hours after receiving your budget, move date, preferred areas, and must-have requirements.",
  },
];

export default function FAQ() {
  usePageMeta(
    "Houston Apartment Locator FAQ | Habitat Apartment Locators",
    "Frequently asked questions about free Houston apartment locators, credit score requirements, broken leases, move-in specials, and the apartment search process."
  );

  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(faq => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    });
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-dark text-white">
      <Navbar />
      <main>
        <section className="pt-32 pb-16 md:pt-40 md:pb-24">
          <div className="container max-w-4xl">
            <p className="text-gold text-xs font-medium tracking-widest uppercase mb-4">
              Questions Answered
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-tight mb-6">
              Houston Apartment Locator FAQ
            </h1>
            <p className="text-white/70 text-lg leading-relaxed max-w-2xl">
              Clear answers about how free apartment locating works, what
              apartments look for, and how to start your Houston search.
            </p>
          </div>
        </section>

        <section className="bg-white text-gray-900 py-16 md:py-24">
          <div className="container max-w-4xl">
            <div className="divide-y divide-gray-200">
              {faqs.map(faq => (
                <article key={faq.question} className="py-8 first:pt-0">
                  <h2 className="font-display text-2xl mb-3">{faq.question}</h2>
                  <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20 bg-dark-card">
          <div className="container max-w-3xl">
            <h2 className="font-display text-3xl md:text-4xl mb-4">
              Still have a specific situation?
            </h2>
            <p className="text-white/55 leading-relaxed mb-7">
              Send the details through the form and I will tell you what
              apartment options make sense for your budget, move date, and
              rental history.
            </p>
            <Link
              href="/#contact"
              className="inline-flex items-center justify-center px-7 py-3 bg-gold text-dark font-semibold text-sm rounded hover:opacity-90 transition-opacity"
            >
              Start Your Free Search
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

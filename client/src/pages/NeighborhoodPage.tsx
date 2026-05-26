import { usePageMeta } from "./usePageMeta";
import { neighborhoods } from "./seoContent";
import { useRoute } from "wouter";

export default function NeighborhoodPage() {
  const [match, params] = useRoute("/neighborhoods/:slug");

  if (!match || !params) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <p className="text-xl">Neighborhood not found</p>
      </div>
    );
  }

  const slug = params.slug as string;
  const neighborhood = neighborhoods[slug as keyof typeof neighborhoods];

  if (!neighborhood) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <p className="text-xl">Neighborhood not found</p>
      </div>
    );
  }

  const url = `https://txaptfinder.com/neighborhoods/${slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: `${neighborhood.name} Apartments - Habitat Locators`,
    description: neighborhood.title,
    url,
    areaServed: {
      "@type": "City",
      name: neighborhood.name,
      addressCountry: "US",
      addressRegion: "TX",
      addressLocality: "Houston",
    },
  };

  usePageMeta({
    title: neighborhood.title,
    description: neighborhood.description,
    url,
    jsonLd,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-amber-500 font-semibold mb-4">HOUSTON NEIGHBORHOODS</p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">{neighborhood.heading}</h1>
          <p className="text-xl text-slate-300">{neighborhood.subheading}</p>
        </div>
      </section>

      {/* Content Sections */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Rent */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-amber-500">Rental Rates</h2>
            <p className="text-lg text-slate-300">{neighborhood.content.rent}</p>
          </div>

          {/* Commute */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-amber-500">Commute & Transportation</h2>
            <p className="text-lg text-slate-300">{neighborhood.content.commute}</p>
          </div>

          {/* Lifestyle */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-amber-500">Lifestyle & Amenities</h2>
            <p className="text-lg text-slate-300">{neighborhood.content.lifestyle}</p>
          </div>

          {/* Landmarks */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-amber-500">Nearby Landmarks</h2>
            <p className="text-lg text-slate-300">{neighborhood.content.landmarks}</p>
          </div>

          {/* Specials */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-amber-500">Current Move-In Specials</h2>
            <p className="text-lg text-slate-300">{neighborhood.content.specials}</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Explore {neighborhood.name}?</h2>
          <p className="text-lg text-slate-300 mb-8">
            Let us help you find the perfect apartment in {neighborhood.name}. Our service is 100% free.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/#contact"
              className="inline-block bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 px-8 rounded transition"
            >
              Start Your Search
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

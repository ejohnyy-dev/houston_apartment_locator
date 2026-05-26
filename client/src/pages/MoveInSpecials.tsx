import { usePageMeta } from "./usePageMeta";
import { moveInSpecials } from "./seoContent";

export default function MoveInSpecials() {
  usePageMeta({
    title: "Houston Apartment Move-In Specials | Current Deals | Habitat Locators",
    description:
      "Discover current move-in specials in Houston. Waived fees, free rent, upgraded amenities, and more. Save big on your next apartment.",
    url: "https://txaptfinder.com/houston-apartment-move-in-specials",
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-amber-500 font-semibold mb-4">CURRENT OFFERS</p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">Houston Apartment Move-In Specials</h1>
          <p className="text-xl text-slate-300 mb-8">
            Save thousands with current move-in specials, waived fees, and exclusive deals. We know every offer in Houston.
          </p>
        </div>
      </section>

      {/* Specials Grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {moveInSpecials.map((special, idx) => (
              <div key={idx} className="bg-slate-800 rounded-lg p-8 border border-slate-700 hover:border-amber-500 transition">
                <h3 className="text-xl font-bold mb-4 text-amber-500">{special.title}</h3>
                <p className="text-slate-300">{special.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Save on Your Next Apartment?</h2>
          <p className="text-lg text-slate-300 mb-8">
            Let us help you find the best move-in specials available right now. Our service is 100% free.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/#contact"
              className="inline-block bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 px-8 rounded transition"
            >
              Get Started
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

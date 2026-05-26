import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { Link } from "wouter";
import { usePageMeta } from "./usePageMeta";

const dealGroups = [
  {
    area: "Downtown and Midtown",
    deals: [
      "Luxury towers offering 4 to 8 weeks free on selected lease terms",
      "Mid-rise communities with waived application or admin fees",
      "Look-and-lease incentives for renters ready to apply after touring",
    ],
  },
  {
    area: "Galleria and Uptown",
    deals: [
      "High-rise concessions that can materially lower effective monthly rent",
      "Parking upgrades or reduced deposits at select properties",
      "Short-term and corporate lease options for relocations",
    ],
  },
  {
    area: "The Heights, Montrose, and Medical Center",
    deals: [
      "New-construction specials while buildings fill initial occupancy",
      "Healthcare-worker incentives near the Texas Medical Center",
      "Pet-fee reductions and flexible lease options where available",
    ],
  },
];

export default function MoveInSpecials() {
  usePageMeta(
    "Houston Apartment Move-In Specials | Free Locator Service | Habitat",
    "Find Houston apartment move-in specials with a free apartment locator. Compare weeks free, waived fees, reduced deposits, and locator-only apartment deals."
  );

  return (
    <div className="min-h-screen bg-dark text-white">
      <Navbar />
      <main>
        <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(210,171,75,0.18),transparent_34rem)]" />
          <div className="relative container max-w-4xl">
            <p className="text-gold text-xs font-medium tracking-widest uppercase mb-4">
              Houston Apartment Deals
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-tight mb-6">
              Houston Apartment Move-In Specials
            </h1>
            <p className="text-white/70 text-lg leading-relaxed max-w-2xl">
              Houston apartment specials change constantly. I help renters
              compare the real value behind weeks free, waived fees, deposits,
              and hidden locator-only concessions.
            </p>
          </div>
        </section>

        <section className="bg-white text-gray-900 py-16 md:py-24">
          <div className="container grid gap-12 lg:grid-cols-[1fr_22rem]">
            <div className="max-w-3xl">
              <h2 className="font-display text-3xl md:text-4xl mb-6">
                Current Houston apartment deals and discounts
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed mb-10">
                Move-in specials can save hundreds or thousands over a lease,
                but the headline deal is not always the best deal. The right
                choice depends on base rent, fees, parking, lease term, move-in
                date, and availability.
              </p>

              <div className="space-y-10">
                {dealGroups.map(group => (
                  <section key={group.area}>
                    <h3 className="font-display text-2xl mb-4">{group.area}</h3>
                    <ul className="space-y-3">
                      {group.deals.map(deal => (
                        <li
                          key={deal}
                          className="text-gray-600 leading-relaxed"
                        >
                          {deal}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>

            <aside className="lg:sticky lg:top-24 self-start border-l border-gray-200 pl-6">
              <p className="text-gold text-xs font-medium tracking-widest uppercase mb-4">
                What I Check
              </p>
              <ul className="space-y-3 text-gray-600 mb-8">
                <li>Effective rent after concessions</li>
                <li>Required lease length</li>
                <li>Admin, app, parking, pet, and amenity fees</li>
                <li>Actual availability for your move date</li>
                <li>Whether the special applies to your floor plan</li>
              </ul>
              <Link
                href="/#contact"
                className="inline-flex items-center justify-center px-6 py-3 bg-gold text-dark font-semibold text-sm rounded hover:opacity-90 transition-opacity"
              >
                Ask for Current Specials
              </Link>
            </aside>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

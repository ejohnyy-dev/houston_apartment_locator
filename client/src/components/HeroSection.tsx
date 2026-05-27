import { HomeMapView } from "./HomeMapView";
import { MapSearchFilter, type MapFilters } from "./MapSearchFilter";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663501304397/4gMGD9qetV63jA9Ts6DXxD/DiWnH726c4RI_566565c1.jpg";

interface HeroSectionProps {
  mapFilters?: MapFilters;
  onFilterChange?: (filters: MapFilters) => void;
}

export default function HeroSection({ mapFilters, onFilterChange }: HeroSectionProps) {
  return (
    <section className="relative py-20">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={HERO_BG} alt="Houston skyline" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 container">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <p className="text-gold text-sm font-medium tracking-widest uppercase mb-4">
            Habitat Apartment Locators
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-6">
            Find Your Perfect Apartment in Houston
          </h1>
          <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-lg mx-auto">
            I'm Eric Johnson, your dedicated Houston apartment locator. My service is 100% free — I do the work so you don't have to.
          </p>
        </div>

        {/* Search Filter */}
        <div className="max-w-4xl mx-auto mb-6">
          <MapSearchFilter onFilterChange={onFilterChange} />
        </div>

        {/* Map Section */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="rounded-xl overflow-hidden shadow-2xl border border-gold/20 h-96 bg-slate-800">
            <HomeMapView className="rounded-lg" filters={mapFilters} />
          </div>
        </div>

        {/* Button */}
        <div className="flex justify-center">
          <a href="/search" className="inline-flex items-center justify-center px-7 py-3 bg-gold text-dark font-semibold text-sm rounded hover:opacity-90 transition-opacity">
            Search Apartments
          </a>
        </div>
      </div>
    </section>
  );
}

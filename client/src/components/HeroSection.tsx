const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663501304397/4gMGD9qetV63jA9Ts6DXxD/DiWnH726c4RI_566565c1.jpg";

export default function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={HERO_BG} alt="Houston skyline" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 container py-32">
        <div className="max-w-2xl">
          <p className="text-gold text-sm font-medium tracking-widest uppercase mb-4">
            Habitat Apartment Locators
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-6">
            Find Your Perfect Apartment in Houston
          </h1>
          <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-lg">
            I'm Eric Johnson, your dedicated Houston apartment locator. My service is 100% free — I do the work so you don't have to.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href="/search" className="inline-flex items-center justify-center px-7 py-3 bg-gold text-dark font-semibold text-sm rounded hover:opacity-90 transition-opacity">
              Search Apartments
            </a>
            <a href="tel:8326037278" className="inline-flex items-center justify-center px-7 py-3 border border-white/20 text-white font-medium text-sm rounded hover:border-white/40 transition-colors">
              Call (832) 603-7278
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

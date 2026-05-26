import {
  Search,
  DollarSign,
  MapPin,
  Handshake,
  Clock,
  ShieldCheck,
} from "lucide-react";

const services = [
  {
    icon: Search,
    title: "Personalized Search",
    desc: "We learn your needs — budget, lifestyle, commute, pets — and curate a shortlist of apartments that actually fit.",
  },
  {
    icon: DollarSign,
    title: "100% Free",
    desc: "Our service costs you nothing. Apartment communities compensate us, so you get expert help at zero cost.",
  },
  {
    icon: MapPin,
    title: "Local Expertise",
    desc: "We know Houston inside and out — every neighborhood, every hidden gem, every complex worth your time.",
  },
  {
    icon: Handshake,
    title: "Move-In Deals",
    desc: "We negotiate exclusive specials and move-in deals you won't find on your own, saving you hundreds.",
  },
  {
    icon: Clock,
    title: "Save Your Time",
    desc: "Skip the endless scrolling. We schedule tours, compare options, and handle the legwork for you.",
  },
  {
    icon: ShieldCheck,
    title: "Trusted Guidance",
    desc: "From application to move-in day, we guide you through every step so nothing falls through the cracks.",
  },
];

export default function ServicesSection() {
  return (
    <section id="services" className="py-20 md:py-28 bg-dark">
      <div className="container">
        <div className="text-center max-w-xl mx-auto mb-14">
          <p className="text-gold text-xs font-medium tracking-widest uppercase mb-3">
            What We Offer
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-white mb-4">
            How Our Free Houston Apartment Locator Service Works
          </h2>
          <p className="text-white/50 text-base leading-relaxed">
            We handle every detail so you can focus on starting your next
            chapter in Houston.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map(s => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="p-6 rounded border border-white/5 bg-dark-card hover:border-gold/20 transition-colors"
              >
                <Icon size={20} className="text-gold mb-4" />
                <h3 className="font-display text-lg text-white mb-2">
                  {s.title}
                </h3>
                <p className="text-white/45 text-sm leading-relaxed">
                  {s.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

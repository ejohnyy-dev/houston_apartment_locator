const highlights = [
  {
    image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663501304397/4gMGD9qetV63jA9Ts6DXxD/l7NQwmCNmwxG_9e43fb8a.jpg",
    fallbackGradient: "from-slate-800 via-slate-700 to-slate-600",
    title: "Downtown Skyline",
    desc: "Fortune 500 headquarters, the Texas Medical Center, and a thriving business district.",
  },
  {
    image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663501304397/4gMGD9qetV63jA9Ts6DXxD/y0Y3lAO4Nfwv_dedbc697.jpg",
    fallbackGradient: "from-green-900 via-green-800 to-emerald-700",
    title: "Parks & Outdoors",
    desc: "Buffalo Bayou, Hermann Park, and over 56,000 acres of green space to explore.",
  },
  {
    image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663501304397/4gMGD9qetV63jA9Ts6DXxD/ZJJBkVJ2hskx_20ff0ad2.jpg",
    fallbackGradient: "from-purple-900 via-purple-800 to-indigo-700",
    title: "Arts & Culture",
    desc: "19 museums, a world-class theater district, and one of the most diverse food scenes in the U.S.",
  },
  {
    image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663501304397/4gMGD9qetV63jA9Ts6DXxD/Bua6QUNyiAOd_b89f3a50.jpg",
    fallbackGradient: "from-blue-900 via-blue-800 to-cyan-700",
    title: "Connected City",
    desc: "Major highways, Metro rail, and two international airports keep you connected.",
  },
];

import { useState } from "react";

function NeighborhoodCard({ h }: { h: typeof highlights[number] }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className="group relative overflow-hidden rounded">
      <div className="aspect-[16/10]">
        {imgFailed ? (
          <div className={`w-full h-full bg-gradient-to-br ${h.fallbackGradient}`} />
        ) : (
          <img
            src={h.image}
            alt={h.title}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <h3 className="font-display text-lg text-white mb-1">{h.title}</h3>
        <p className="text-white/70 text-sm leading-relaxed">{h.desc}</p>
      </div>
    </div>
  );
}

export default function HoustonSection() {
  return (
    <section id="houston" className="py-20 md:py-28 bg-white">
      <div className="container">
        <div className="text-center max-w-xl mx-auto mb-14">
          <p className="text-gold text-xs font-medium tracking-widest uppercase mb-3">Discover Houston</p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">
            Top Houston Neighborhoods for Renters
          </h2>
          <p className="text-gray-500 text-base leading-relaxed">
            Affordable, diverse, and full of opportunity — the fourth-largest city in the U.S. has something for everyone.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {highlights.map((h) => (
            <NeighborhoodCard key={h.title} h={h} />
          ))}
        </div>

        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { val: "2.3M+", label: "Population" },
            { val: "No", label: "State Income Tax" },
            { val: "145+", label: "Languages Spoken" },
            { val: "#1", label: "Most Diverse City" },
          ].map((s) => (
            <div key={s.label}>
              <div className="font-display text-2xl md:text-3xl text-gold">{s.val}</div>
              <div className="text-gray-400 text-xs tracking-wide uppercase mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Neighborhood Links */}
        <div className="mt-16 pt-12 border-t border-gray-200">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h3 className="font-display text-2xl md:text-3xl text-gray-900 mb-3">Popular Neighborhoods</h3>
            <p className="text-gray-500 text-sm">Explore apartments in Houston's most sought-after areas</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "Downtown Houston", slug: "downtown-houston-apartments", desc: "Urban living with high-rise apartments and walkable streets" },
              { name: "Midtown Houston", slug: "midtown-houston-apartments", desc: "Vibrant nightlife, dining, and modern apartment complexes" },
              { name: "The Heights", slug: "the-heights-apartments", desc: "Trendy neighborhood with historic charm and new development" },
              { name: "Galleria Area", slug: "galleria-apartments", desc: "Upscale shopping, dining, and premium apartment communities" },
              { name: "Medical Center", slug: "medical-center-apartments", desc: "Close to Texas Medical Center with diverse housing options" },
            ].map((n) => (
              <a
                key={n.slug}
                href={`/neighborhoods/${n.slug}`}
                className="p-4 rounded border border-gray-200 hover:border-gold hover:bg-gold/5 transition-all"
              >
                <h4 className="font-display text-lg text-gray-900 mb-1">{n.name}</h4>
                <p className="text-gray-500 text-sm">{n.desc}</p>
              </a>
            ))}
          </div>
        </div>

        {/* CTA Links */}
        <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/houston-apartment-move-in-specials" className="px-6 py-3 bg-gold text-dark font-semibold rounded hover:opacity-90 transition-opacity text-center">
            View Move-In Specials
          </a>
          <a href="/faq" className="px-6 py-3 border border-gray-300 text-gray-900 font-semibold rounded hover:bg-gray-50 transition-colors text-center">
            Read FAQ
          </a>
        </div>
      </div>
    </section>
  );
}

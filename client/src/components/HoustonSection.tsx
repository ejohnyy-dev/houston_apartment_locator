const highlights = [
  {
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663501304397/4gMGD9qetV63jA9Ts6DXxD/l7NQwmCNmwxG_9e43fb8a.jpg",
    title: "Downtown Skyline",
    desc: "Fortune 500 headquarters, the Texas Medical Center, and a thriving business district.",
  },
  {
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663501304397/4gMGD9qetV63jA9Ts6DXxD/y0Y3lAO4Nfwv_dedbc697.jpg",
    title: "Parks & Outdoors",
    desc: "Buffalo Bayou, Hermann Park, and over 56,000 acres of green space to explore.",
  },
  {
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663501304397/4gMGD9qetV63jA9Ts6DXxD/ZJJBkVJ2hskx_20ff0ad2.jpg",
    title: "Arts & Culture",
    desc: "19 museums, a world-class theater district, and one of the most diverse food scenes in the U.S.",
  },
  {
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663501304397/4gMGD9qetV63jA9Ts6DXxD/Bua6QUNyiAOd_b89f3a50.jpg",
    title: "Connected City",
    desc: "Major highways, Metro rail, and two international airports keep you connected.",
  },
];

export default function HoustonSection() {
  return (
    <section id="houston" className="py-20 md:py-28 bg-white">
      <div className="container">
        <div className="text-center max-w-xl mx-auto mb-14">
          <p className="text-gold text-xs font-medium tracking-widest uppercase mb-3">
            Discover Houston
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">
            Top Houston Neighborhoods for Renters
          </h2>
          <p className="text-gray-500 text-base leading-relaxed">
            Affordable, diverse, and full of opportunity — the fourth-largest
            city in the U.S. has something for everyone.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {highlights.map(h => (
            <div
              key={h.title}
              className="group relative overflow-hidden rounded"
            >
              <div className="aspect-[16/10]">
                <img
                  src={h.image}
                  alt={h.title}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h3 className="font-display text-lg text-white mb-1">
                  {h.title}
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  {h.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { val: "2.3M+", label: "Population" },
            { val: "No", label: "State Income Tax" },
            { val: "145+", label: "Languages Spoken" },
            { val: "#1", label: "Most Diverse City" },
          ].map(s => (
            <div key={s.label}>
              <div className="font-display text-2xl md:text-3xl text-gold">
                {s.val}
              </div>
              <div className="text-gray-400 text-xs tracking-wide uppercase mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { Link } from "wouter";
import { neighborhoods, type NeighborhoodSlug } from "./seoContent";
import { usePageMeta } from "./usePageMeta";

type Props = {
  slug: NeighborhoodSlug;
};

export default function NeighborhoodPage({ slug }: Props) {
  const page = neighborhoods[slug];

  usePageMeta(page.metaTitle, page.metaDescription);

  return (
    <div className="min-h-screen bg-dark text-white">
      <Navbar />
      <main>
        <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(210,171,75,0.16),transparent_34rem)]" />
          <div className="relative container">
            <div className="max-w-3xl">
              <p className="text-gold text-xs font-medium tracking-widest uppercase mb-4">
                Houston Neighborhood Guide
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-tight mb-5">
                {page.title}
              </h1>
              <p className="text-white/70 text-lg leading-relaxed max-w-2xl">
                {page.eyebrow}
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24 bg-white text-gray-900">
          <div className="container grid gap-12 lg:grid-cols-[1fr_22rem]">
            <article className="max-w-3xl">
              <h2 className="font-display text-3xl md:text-4xl mb-6">
                Why renters choose {page.title.replace(" Apartments", "")}
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed mb-10">
                {page.intro}
              </p>

              <div className="space-y-10">
                {[
                  ["Average rent and apartment pricing", page.rent],
                  ["Commute and transportation", page.commute],
                  ["Lifestyle and amenities", page.lifestyle],
                  ["Current move-in specials", page.specials],
                ].map(([title, body]) => (
                  <section key={title}>
                    <h3 className="font-display text-2xl mb-3">{title}</h3>
                    <p className="text-gray-600 leading-relaxed">{body}</p>
                  </section>
                ))}
              </div>
            </article>

            <aside className="lg:sticky lg:top-24 self-start border-l border-gray-200 pl-6">
              <p className="text-gold text-xs font-medium tracking-widest uppercase mb-4">
                Nearby
              </p>
              <ul className="space-y-3 mb-8">
                {page.nearby.map(item => (
                  <li key={item} className="text-gray-600">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-gray-700 leading-relaxed mb-6">{page.cta}</p>
              <Link
                href="/#contact"
                className="inline-flex items-center justify-center px-6 py-3 bg-gold text-dark font-semibold text-sm rounded hover:opacity-90 transition-opacity"
              >
                Start Your Search
              </Link>
            </aside>
          </div>
        </section>

        <section className="py-16 md:py-20 bg-dark-card">
          <div className="container">
            <div className="max-w-3xl">
              <p className="text-gold text-xs font-medium tracking-widest uppercase mb-3">
                Free Locator Help
              </p>
              <h2 className="font-display text-3xl md:text-4xl mb-4">
                Get a custom shortlist before you tour.
              </h2>
              <p className="text-white/55 leading-relaxed mb-7">
                Share your move date, budget, pet needs, commute, and must-have
                amenities. Eric Johnson will compare active availability and
                specials so you are not wasting time on the wrong buildings.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/#contact"
                  className="inline-flex items-center justify-center px-7 py-3 bg-gold text-dark font-semibold text-sm rounded hover:opacity-90 transition-opacity"
                >
                  Get Apartment Matches
                </Link>
                <a
                  href="tel:8326037278"
                  className="inline-flex items-center justify-center px-7 py-3 border border-white/20 text-white font-medium text-sm rounded hover:border-white/40 transition-colors"
                >
                  Call (832) 603-7278
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

import { usePageMeta } from "./usePageMeta";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Tag, Home } from "lucide-react";

function formatRent(min: number | null, max: number | null): string {
  if (!min) return "";
  if (!max || max === min) return `$${min.toLocaleString()}/mo`;
  return `$${min.toLocaleString()}–$${max.toLocaleString()}/mo`;
}

export default function MoveInSpecials() {
  usePageMeta({
    title: "Houston Apartment Move-In Specials | Current Deals | Habitat Locators",
    description:
      "Discover current move-in specials in Houston. Waived fees, free rent, upgraded amenities, and more. Save big on your next apartment.",
    url: "https://txaptfinder.com/houston-apartment-move-in-specials",
  });

  const { data: specials, isLoading, isError } = trpc.apartments.specials.useQuery(undefined, {
    staleTime: 5 * 60_000,
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
          {!isLoading && !isError && specials && specials.length > 0 && (
            <Badge className="bg-amber-500 text-slate-900 text-sm px-4 py-1.5">
              {specials.length} active special{specials.length !== 1 ? "s" : ""} right now
            </Badge>
          )}
        </div>
      </section>

      {/* Specials Grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-slate-800 rounded-lg p-8 border border-slate-700">
                  <Skeleton className="h-5 w-2/3 mb-4 bg-slate-700" />
                  <Skeleton className="h-4 w-full mb-2 bg-slate-700" />
                  <Skeleton className="h-4 w-4/5 bg-slate-700" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-16">
              <p className="text-slate-400 text-lg">Unable to load specials right now. Please try again later.</p>
            </div>
          ) : specials && specials.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {specials.map((s, idx) => (
                <div
                  key={`${s.id}-${idx}`}
                  className="bg-slate-800 rounded-lg p-8 border border-slate-700 hover:border-amber-500 transition group"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
                      <Tag className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition leading-tight">
                        {s.name}
                      </h3>
                      {s.neighborhood && (
                        <p className="flex items-center gap-1 text-slate-400 text-xs mt-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {s.neighborhood}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-4">{s.special}</p>
                  {(s.rentMin || s.rentMax) && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400">
                      <Home className="w-3.5 h-3.5" />
                      {formatRent(s.rentMin, s.rentMax)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-slate-400 text-lg mb-4">
                No active specials in our database right now — but new ones are added daily.
              </p>
              <p className="text-slate-500 text-sm">
                Contact us and we'll personally find the best current offers for your budget.
              </p>
            </div>
          )}
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
            <Link
              href="/search"
              className="inline-block bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 px-8 rounded transition"
            >
              Search Apartments
            </Link>
            <a
              href="/#contact"
              className="inline-block border-2 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-slate-900 font-bold py-3 px-8 rounded transition"
            >
              Get Started Free
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

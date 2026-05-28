import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Home as HomeIcon, Search, BarChart3, Camera, Shield, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";

const features = [
  {
    icon: Search,
    bgColor: 'bg-sky-100',
    iconColor: 'text-sky-700',
    title: 'Search RentCast Listings',
    description: 'Browse active API listing data for our selected target addresses, with pricing and rental details coming from RentCast.',
  },
  {
    icon: Camera,
    bgColor: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
    title: 'Use Fresh API Data',
    description: 'The site reads cached RentCast results so visitors do not spend API requests while browsing.',
  },
  {
    icon: Sparkles,
    bgColor: 'bg-amber-100',
    iconColor: 'text-amber-700',
    title: 'Control Request Spend',
    description: 'Monthly budget controls limit RentCast lookups while keeping cached matches available on the website.',
  },
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { data: stats } = trpc.apartments.databaseStats.useQuery(undefined, {
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HomeIcon className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">TX Apt Finder</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/search">
              <Button variant="ghost">Browse Apartments</Button>
            </Link>
            {isAuthenticated && user?.role === 'admin' && (
              <Link href="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
            )}
            {!isAuthenticated ? (
              <a href={getLoginUrl()}>
                <Button className="bg-blue-600 hover:bg-blue-700">Sign In</Button>
              </a>
            ) : (
              <div className="text-sm text-slate-600">
                Welcome, {user?.name || 'User'}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700 mb-4">
              RentCast-powered apartment search
            </p>
            <h2 className="text-5xl font-bold text-slate-950 mb-6 leading-tight">
              Search apartment listings from the API
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              Browse RentCast listing matches for our selected apartment targets, compare pricing and details, then capture renter interest.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/search">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                  Search Properties <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              {isAuthenticated && user?.role === 'admin' && (
                <Link href="/dashboard">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    View Leads
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="border-b border-r border-slate-100 pb-5 pr-5">
                <p className="text-4xl font-bold text-slate-950">{stats?.eligibleProperties ?? "..."}</p>
                <p className="text-sm text-slate-500 mt-1">RentCast listings found</p>
              </div>
              <div className="border-b border-slate-100 pb-5 pl-1">
                <p className="text-4xl font-bold text-slate-950">{stats?.cities ?? "..."}</p>
                <p className="text-sm text-slate-500 mt-1">Houston-area cities</p>
              </div>
              <div className="border-r border-slate-100 pt-2 pr-5">
                <p className="text-4xl font-bold text-slate-950">{stats?.monthlyRequestsRemaining ?? "..."}</p>
                <p className="text-sm text-slate-500 mt-1">monthly requests left</p>
              </div>
              <div className="pt-2 pl-1">
                <p className="text-4xl font-bold text-slate-950">{stats?.totalProperties ?? "..."}</p>
                <p className="text-sm text-slate-500 mt-1">target addresses</p>
              </div>
            </div>
            <div className="mt-6 rounded-lg bg-slate-950 text-white p-5">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-200">
                  Public listings are API-only. Target addresses without a RentCast match do not appear in search.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-3xl font-bold text-slate-900 mb-12 text-center">Built for locating work</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="p-8">
                  <div className={`${feature.bgColor} rounded-lg p-4 w-fit mb-4`}>
                    <Icon className={`w-8 h-8 ${feature.iconColor}`} />
                  </div>
                  <h4 className="text-xl font-semibold text-slate-900 mb-3">{feature.title}</h4>
                  <p className="text-slate-600">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 py-20">
        <Card className="bg-blue-700 text-white p-12 rounded-lg">
          <div className="max-w-2xl">
            <h3 className="text-3xl font-bold mb-4">Ready to search the database?</h3>
            <p className="text-blue-100 mb-8">
              Start with complete property profiles, then capture renter contact details before sharing deeper information.
            </p>
            <Link href="/search">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-slate-100">
                Open Search <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <HomeIcon className="w-6 h-6 text-blue-400" />
                <h4 className="font-semibold text-white">TX Apt Finder</h4>
              </div>
              <p className="text-sm">Searchable property data for apartment locating.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/search" className="hover:text-white">Browse Apartments</Link></li>
                <li><Link href="/" className="hover:text-white">Home</Link></li>
              </ul>
            </div>
            {isAuthenticated && user?.role === 'admin' && (
              <div>
                <h4 className="font-semibold text-white mb-4">For Landlords</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/dashboard" className="hover:text-white">Dashboard</Link></li>
                </ul>
              </div>
            )}
            <div>
              <h4 className="font-semibold text-white mb-4">Contact</h4>
              <p className="text-sm">Have questions? Reach out to us for support.</p>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-sm">
            <p>&copy; 2026 TX Apt Finder. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

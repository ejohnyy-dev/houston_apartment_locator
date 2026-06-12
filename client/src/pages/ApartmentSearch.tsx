import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Search, X, Sparkles, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useQualification } from "@/contexts/QualificationContext";
import { QualificationPrompt, DEFAULT_NEIGHBORHOODS } from "@/components/QualificationPrompt";
import { loadMapScript, HOUSTON_CENTER } from "@/components/HomeMapView";
import { getMatchResult, getMatchTier, type MatchResult } from "@/lib/qualificationFilter";
import { fetchApartments, type Apartment } from "@/lib/apartments";
import {
  decodeSearchFilters,
  encodeSearchFilters,
  RENT_RANGE_DEFAULT,
  type SearchFilterState,
  type SortOption,
} from "@/lib/searchParams";
import { usePageMeta } from "./usePageMeta";

const PAGE_SIZE = 30;

function formatRent(min: number, max: number): string {
  if (!min || min <= 0) return "Pricing by request";
  if (max && max !== min) {
    return `$${min.toLocaleString()} – $${max.toLocaleString()}/mo`;
  }
  return `$${min.toLocaleString()}/mo`;
}

function formatBedrooms(bedrooms: number): string {
  return bedrooms === 0 ? "Studio" : `${bedrooms} Bed`;
}

/** Best displayable price given the active bedroom filter. */
function getBedroomAwareRent(
  apt: Apartment,
  bedroomFilter: string
): { min: number; max: number } {
  const br = parseInt(bedroomFilter, 10);
  if (bedroomFilter && !isNaN(br)) {
    if (br === 1 && apt.price1brMin != null) {
      return { min: apt.price1brMin, max: apt.price1brMax ?? apt.price1brMin };
    }
    if (br === 2 && apt.price2brMin != null) {
      return { min: apt.price2brMin, max: apt.price2brMax ?? apt.price2brMin };
    }
  }
  return { min: apt.rentMin, max: apt.rentMax };
}

function matchesFilters(apt: Apartment, filters: SearchFilterState): boolean {
  if (filters.neighborhood && apt.neighborhood !== filters.neighborhood) return false;

  if (filters.bedrooms) {
    const want = parseInt(filters.bedrooms, 10);
    if (want === 4) {
      if (apt.bedrooms < 4) return false;
    } else if (apt.bedrooms !== want) {
      return false;
    }
  }

  const [minRent, maxRent] = filters.rentRange;
  const isDefaultRange =
    minRent === RENT_RANGE_DEFAULT[0] && maxRent === RENT_RANGE_DEFAULT[1];
  if (!isDefaultRange) {
    const { min } = getBedroomAwareRent(apt, filters.bedrooms);
    // Unpriced ("pricing by request") listings stay visible unless the
    // visitor has actively narrowed the range.
    if (min > 0 && (min < minRent || min > maxRent)) return false;
  }

  if (filters.searchText.trim()) {
    const haystack = `${apt.name} ${apt.neighborhood} ${apt.description} ${apt.amenities.join(" ")}`.toLowerCase();
    // AND semantics: every term must appear somewhere in the listing
    const terms = filters.searchText.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.every((term) => haystack.includes(term))) return false;
  }

  return true;
}

interface ApartmentCardProps {
  apartment: Apartment;
  match?: MatchResult | null;
  bedroomFilter: string;
  isSelected: boolean;
  onSelect: () => void;
}

function ApartmentCard({ apartment, match, bedroomFilter, isSelected, onSelect }: ApartmentCardProps) {
  const tier = match ? getMatchTier(match.score) : null;
  const rent = getBedroomAwareRent(apartment, bedroomFilter);

  return (
    <Card
      onClick={onSelect}
      className={cn(
        "p-4 cursor-pointer transition-all hover:shadow-md border",
        isSelected ? "border-primary ring-1 ring-primary" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-base truncate">{apartment.name}</h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {apartment.neighborhood} area
          </p>
        </div>
        {tier && (
          <Badge
            variant="secondary"
            className={cn(
              "shrink-0 gap-1",
              tier === "great"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-sky-500/15 text-sky-600 dark:text-sky-400"
            )}
          >
            <Sparkles className="w-3 h-3" />
            {tier === "great" ? "Great match" : "Good match"}
          </Badge>
        )}
      </div>

      <p className="text-lg font-semibold text-primary mt-2">
        {formatRent(rent.min, rent.max)}
      </p>
      <p className="text-sm text-muted-foreground">
        {formatBedrooms(apartment.bedrooms)} · {apartment.bathrooms} Bath
        {apartment.minSqft ? ` · ${apartment.minSqft.toLocaleString()}–${(apartment.maxSqft ?? apartment.minSqft).toLocaleString()} sqft` : ""}
      </p>

      {apartment.special && (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-2">
          ★ {apartment.special}
        </p>
      )}

      {match && match.reasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {match.reasons.map((reason) => (
            <span
              key={reason}
              className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              {reason}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
        {apartment.description}
      </p>

      <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Exact property shared by your locator
        </p>
        <a href="/#contact">
          <Button size="sm" variant="outline" className="gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" />
            Ask about this one
          </Button>
        </a>
      </div>
    </Card>
  );
}

export default function ApartmentSearch() {
  usePageMeta(
    "Search Houston Apartments | Habitat Apartment Locators",
    "Browse curated Houston apartment listings by area, budget, and bedrooms. Your locator shares exact properties, tours, and current specials."
  );

  const {
    qualificationData,
    hasCompletedQuestionnaire,
    hasQualified,
    showQualificationPrompt,
    setQualificationData,
    markQualified,
    setShowQualificationPrompt,
  } = useQualification();

  const [apartments, setApartments] = useState<Apartment[] | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [filters, setFilters] = useState<SearchFilterState>(() =>
    decodeSearchFilters(window.location.search)
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<number, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const hasAccessRef = useRef(hasQualified);
  useEffect(() => {
    hasAccessRef.current = hasQualified;
  }, [hasQualified]);

  // The questionnaire is mandatory: prompt immediately on arrival
  useEffect(() => {
    if (!hasQualified) setShowQualificationPrompt(true);
  }, [hasQualified, setShowQualificationPrompt]);

  // Load inventory
  useEffect(() => {
    let cancelled = false;
    fetchApartments()
      .then((data) => {
        if (cancelled) return;
        setApartments(data.apartments);
        setNeighborhoods(data.neighborhoods);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the URL shareable: encode active filters into the query string
  useEffect(() => {
    const qs = encodeSearchFilters(filters);
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [filters]);

  // Match scores keyed by listing id (recomputed when answers change)
  const matchById = useMemo(() => {
    const result = new Map<number, MatchResult>();
    if (!apartments || !qualificationData) return result;
    for (const apt of apartments) {
      result.set(apt.id, getMatchResult(apt, qualificationData));
    }
    return result;
  }, [apartments, qualificationData]);

  const filteredApartments = useMemo(() => {
    if (!apartments) return [];
    const list = apartments.filter((apt) => matchesFilters(apt, filters));

    const priceOf = (apt: Apartment) => {
      const { min } = getBedroomAwareRent(apt, filters.bedrooms);
      return min > 0 ? min : Number.MAX_SAFE_INTEGER;
    };

    switch (filters.sortBy) {
      case "price-asc":
        return [...list].sort((a, b) => priceOf(a) - priceOf(b));
      case "price-desc":
        return [...list].sort((a, b) => {
          const pa = priceOf(a) === Number.MAX_SAFE_INTEGER ? 0 : priceOf(a);
          const pb = priceOf(b) === Number.MAX_SAFE_INTEGER ? 0 : priceOf(b);
          return pb - pa;
        });
      case "recommended":
      default:
        if (matchById.size === 0) return list;
        // Stable sort by match score, best first
        return list
          .map((apt, index) => ({ apt, index, score: matchById.get(apt.id)?.score ?? 0 }))
          .sort((a, b) => b.score - a.score || a.index - b.index)
          .map(({ apt }) => apt);
    }
  }, [apartments, filters, matchById]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters]);

  const updateFilter = useCallback(<K extends keyof SearchFilterState>(key: K, value: SearchFilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      neighborhood: "",
      bedrooms: "",
      rentRange: RENT_RANGE_DEFAULT,
      searchText: "",
      sortBy: "recommended",
    });
  }, []);

  const hasActiveFilters =
    filters.neighborhood !== "" ||
    filters.bedrooms !== "" ||
    filters.rentRange[0] !== RENT_RANGE_DEFAULT[0] ||
    filters.rentRange[1] !== RENT_RANGE_DEFAULT[1] ||
    filters.searchText.trim() !== "";

  // ----- Map -----
  const initMap = useCallback(async () => {
    await loadMapScript();
    if (!mapContainer.current || !window.google?.maps || mapRef.current) return;
    mapRef.current = new window.google.maps.Map(mapContainer.current, {
      zoom: 10,
      center: HOUSTON_CENTER,
      mapTypeControl: false,
      fullscreenControl: true,
      zoomControl: true,
      streetViewControl: false,
      mapId: "DEMO_MAP_ID",
    });
    infoWindowRef.current = new window.google.maps.InfoWindow();
  }, []);

  useEffect(() => {
    initMap();
  }, [initMap]);

  // Sync markers with the filtered list
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps?.marker) return;

    const wanted = new Set(filteredApartments.map((a) => a.id));

    // Remove stale markers
    markersRef.current.forEach((marker, id) => {
      if (!wanted.has(id)) {
        marker.map = null;
        markersRef.current.delete(id);
      }
    });

    // Add missing markers
    filteredApartments.forEach((apt) => {
      if (markersRef.current.has(apt.id)) return;
      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: apt.latitude, lng: apt.longitude },
        title: apt.name,
      });
      marker.addListener("click", () => {
        if (!hasAccessRef.current) {
          setShowQualificationPrompt(true);
          return;
        }
        setSelectedId(apt.id);
        const rent = formatRent(apt.rentMin, apt.rentMax);
        infoWindowRef.current?.setContent(`
          <div style="padding:8px;max-width:240px;color:#111">
            <h3 style="font-weight:600;font-size:14px;margin:0 0 4px">${apt.name}</h3>
            <p style="font-size:12px;color:#555;margin:0 0 4px">${apt.neighborhood} area</p>
            <p style="font-size:13px;font-weight:500;color:#a16207;margin:0">${rent}</p>
          </div>
        `);
        infoWindowRef.current?.open({ map, anchor: marker });
      });
      markersRef.current.set(apt.id, marker);
    });
  }, [filteredApartments, setShowQualificationPrompt]);

  // Pan to a card's marker when selected from the list
  const handleSelect = useCallback((apt: Apartment) => {
    setSelectedId(apt.id);
    const map = mapRef.current;
    if (map) {
      map.panTo({ lat: apt.latitude, lng: apt.longitude });
      if ((map.getZoom() ?? 0) < 12) map.setZoom(12);
    }
  }, []);

  const visibleApartments = filteredApartments.slice(0, visibleCount);
  const areaOptions = neighborhoods.length > 0 ? neighborhoods : DEFAULT_NEIGHBORHOODS;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <QualificationPrompt
        isOpen={showQualificationPrompt && !hasQualified}
        neighborhoods={areaOptions}
        initialData={hasCompletedQuestionnaire ? qualificationData : null}
        onComplete={(data) => {
          setQualificationData(data);
          markQualified();
          setShowQualificationPrompt(false);
        }}
      />

      <main className="flex-1 pt-20">
        {/* Filter bar */}
        <div className="border-b bg-background/95 backdrop-blur sticky top-16 z-20">
          <div className="container mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search area, amenity, community..."
                value={filters.searchText}
                onChange={(e) => updateFilter("searchText", e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              value={filters.neighborhood || "all"}
              onValueChange={(v) => updateFilter("neighborhood", v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All areas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All areas</SelectItem>
                {areaOptions.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.bedrooms || "any"}
              onValueChange={(v) => updateFilter("bedrooms", v === "any" ? "" : v)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Any beds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any beds</SelectItem>
                <SelectItem value="0">Studio</SelectItem>
                <SelectItem value="1">1 Bed</SelectItem>
                <SelectItem value="2">2 Beds</SelectItem>
                <SelectItem value="3">3 Beds</SelectItem>
                <SelectItem value="4">4+ Beds</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 min-w-[220px]">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                ${filters.rentRange[0].toLocaleString()}–${filters.rentRange[1] >= RENT_RANGE_DEFAULT[1] ? `${RENT_RANGE_DEFAULT[1].toLocaleString()}+` : filters.rentRange[1].toLocaleString()}
              </span>
              <Slider
                min={RENT_RANGE_DEFAULT[0]}
                max={RENT_RANGE_DEFAULT[1]}
                step={100}
                value={filters.rentRange}
                onValueChange={(v) => updateFilter("rentRange", [v[0], v[1]] as [number, number])}
                className="w-32"
              />
            </div>

            <Select
              value={filters.sortBy}
              onValueChange={(v) => updateFilter("sortBy", v as SortOption)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended">Recommended</SelectItem>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Results + map */}
        <div className="container mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Listings panel */}
          <div className={cn("space-y-3", !hasQualified && "blur-sm pointer-events-none select-none")}>
            {loadError && (
              <Card className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  We couldn't load listings right now. Please refresh, or{" "}
                  <Link href="/#contact" className="underline">contact us</Link> directly.
                </p>
              </Card>
            )}

            {!apartments && !loadError && (
              <>
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="p-4 space-y-3">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </Card>
                ))}
              </>
            )}

            {apartments && (
              <p className="text-sm text-muted-foreground">
                {filteredApartments.length} {filteredApartments.length === 1 ? "community" : "communities"} match your filters
                {qualificationData && filters.sortBy === "recommended" && " · sorted by your preferences"}
              </p>
            )}

            {visibleApartments.map((apt) => (
              <ApartmentCard
                key={apt.id}
                apartment={apt}
                match={matchById.get(apt.id) ?? null}
                bedroomFilter={filters.bedrooms}
                isSelected={selectedId === apt.id}
                onSelect={() => handleSelect(apt)}
              />
            ))}

            {apartments && filteredApartments.length === 0 && !loadError && (
              <Card className="p-6 text-center">
                <p className="font-medium">No communities match those filters</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try widening your price range or clearing a filter — or{" "}
                  <Link href="/#contact" className="underline">ask your locator</Link>;
                  we have access to far more inventory than what's listed here.
                </p>
              </Card>
            )}

            {filteredApartments.length > visibleCount && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Show more ({filteredApartments.length - visibleCount} remaining)
              </Button>
            )}
          </div>

          {/* Map panel */}
          <div className="relative h-[420px] lg:h-[calc(100vh-180px)] lg:sticky lg:top-32">
            <div ref={mapContainer} className="w-full h-full rounded-lg border" />
            {!hasQualified && (
              <button
                onClick={() => setShowQualificationPrompt(true)}
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-lg cursor-pointer"
              >
                <span className="px-5 py-3 rounded-lg bg-[#C9A96E] text-black font-semibold text-sm shadow-lg">
                  Answer a few questions to unlock the map
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Privacy note */}
        <div className="container mx-auto px-4 pb-8">
          <p className="text-xs text-muted-foreground text-center max-w-xl mx-auto">
            Listing locations are shown at the neighborhood level. Your locator will
            share exact property names, addresses, tour availability, and current
            specials directly with you — at no cost.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

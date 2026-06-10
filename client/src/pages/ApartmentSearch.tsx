import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { cn, getDisplayName } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MapPin, Home, Lock, ArrowRight,
  ChevronLeft, ChevronRight, Search, SlidersHorizontal,
  X, Eye, MessageCircle, Heart, Compass, Bell, BellRing
} from 'lucide-react';
import { MapView } from '@/components/Map';
import { InquiryForm } from '@/components/InquiryForm';
import { Link } from 'wouter';
import { useFavorites } from '@/hooks/useFavorites';
import { useQualification } from '@/contexts/QualificationContext';
import { QualificationPrompt } from '@/components/QualificationPrompt';
import { loadMarkerClustererLibrary, createMarkerClusterer } from '@/lib/markerClusterer';
import { getMatchResult, getMatchTier, type MatchResult } from '@/lib/qualificationFilter';
import { decodeSearchFilters, encodeSearchFilters, RENT_RANGE_DEFAULT } from '@/lib/searchParams';

interface ApartmentTeased {
  id: number;
  name: string;
  neighborhood: string;
  bedrooms: number;
  bathrooms: string | number;
  rentMin: string | number;
  rentMax: string | number | null;
  // Per-bedroom price splits from merged CSV
  price1brMin?: number | null;
  price1brMax?: number | null;
  price2brMin?: number | null;
  price2brMax?: number | null;
  description: string | null;
  latitude: string | number;
  longitude: string | number;
  photos: string[] | null;
  special?: string | null;
  availability?: string | null;
  minSqft?: number | null;
  maxSqft?: number | null;
  builtYear?: number | null;
  managedBy?: string | null;
  photoCount?: number;
}

const DEFAULT_RENT_RANGE: [number, number] = RENT_RANGE_DEFAULT;

// Listings rendered per "page" in the results panel; more load on demand so
// an unfiltered 500+ listing search doesn't render hundreds of cards at once.
const PAGE_SIZE = 30;

// City center fallbacks for Houston-area inventory.
const NEIGHBORHOOD_COORDS: Record<string, { lat: number; lng: number }> = {
  Houston: { lat: 29.7604, lng: -95.3698 },
  'Sugar Land': { lat: 29.6197, lng: -95.6349 },
  Katy: { lat: 29.7858, lng: -95.8244 },
  Cypress: { lat: 29.9691, lng: -95.6972 },
  Spring: { lat: 30.0799, lng: -95.4172 },
  'The Woodlands': { lat: 30.1658, lng: -95.4613 },
  Conroe: { lat: 30.3119, lng: -95.4561 },
  Humble: { lat: 29.9988, lng: -95.2622 },
  Tomball: { lat: 30.0972, lng: -95.6161 },
  Pearland: { lat: 29.5636, lng: -95.2860 },
  Stafford: { lat: 29.6161, lng: -95.5577 },
  Richmond: { lat: 29.5822, lng: -95.7608 },
  Rosenberg: { lat: 29.5572, lng: -95.8086 },
  Kingwood: { lat: 30.0505, lng: -95.1842 },
  Webster: { lat: 29.5377, lng: -95.1183 },
  'League City': { lat: 29.5075, lng: -95.0949 },
  Pasadena: { lat: 29.6911, lng: -95.2091 },
  'Missouri City': { lat: 29.6186, lng: -95.5377 },
};

function getCoords(apt: ApartmentTeased): { lat: number; lng: number } {
  const lat = typeof apt.latitude === 'string' ? parseFloat(apt.latitude) : apt.latitude;
  const lng = typeof apt.longitude === 'string' ? parseFloat(apt.longitude) : apt.longitude;
  if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
    return { lat, lng };
  }
  return NEIGHBORHOOD_COORDS[apt.neighborhood] ?? { lat: 29.7604, lng: -95.3698 };
}

function formatRent(min: string | number, max: string | number | null): string {
  const minNum = typeof min === 'string' ? parseFloat(min) : min;
  const maxNum = max ? (typeof max === 'string' ? parseFloat(max) : max) : null;
  if (!Number.isFinite(minNum) || minNum <= 0) {
    return 'Pricing by request';
  }
  if (maxNum && maxNum !== minNum) {
    return `$${minNum.toLocaleString()} – $${maxNum.toLocaleString()}/mo`;
  }
  return `$${minNum.toLocaleString()}/mo`;
}

function formatBedrooms(bedrooms: number): string {
  return bedrooms === 0 ? 'Studio' : `${bedrooms} Bed`;
}

/**
 * Returns the best available price for display given the active bedroom filter.
 * Falls back to generic rentMin/rentMax when per-bedroom data is absent.
 */
function getBedroomAwareRent(
  apt: ApartmentTeased,
  bedroomFilter: string
): { min: string | number; max: string | number | null } {
  const br = parseInt(bedroomFilter);
  if (bedroomFilter && !isNaN(br)) {
    if (br === 1 && apt.price1brMin != null) {
      return { min: apt.price1brMin, max: apt.price1brMax ?? null };
    }
    if (br === 2 && apt.price2brMin != null) {
      return { min: apt.price2brMin, max: apt.price2brMax ?? null };
    }
  }
  return { min: apt.rentMin, max: apt.rentMax };
}

function formatSqft(apt: ApartmentTeased): string | null {
  if (!apt.minSqft) return null;
  if (apt.maxSqft && apt.maxSqft !== apt.minSqft) {
    return `${apt.minSqft.toLocaleString()}-${apt.maxSqft.toLocaleString()} sqft`;
  }
  return `${apt.minSqft.toLocaleString()} sqft`;
}

function ApartmentCard({
  id,
  apt,
  isLead,
  onLearnMore,
  onViewDetails,
  isSelected,
  isFavorited,
  onToggleFavorite,
  bedroomFilter,
  match,
}: {
  id?: string;
  apt: ApartmentTeased;
  isLead: boolean;
  onLearnMore: () => void;
  onViewDetails: () => void;
  isSelected: boolean;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  bedroomFilter: string;
  match?: MatchResult | null;
}) {
  const photo = apt.photos?.[0];
  const [photoFailed, setPhotoFailed] = useState(false);
  const matchTier = match ? getMatchTier(match.score) : null;

  return (
    <Card
      id={id}
      className={`overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg ${
        isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
      }`}
      onClick={isLead ? onViewDetails : onLearnMore}
    >
      {/* Photo */}
      <div className="relative h-44 bg-slate-100 overflow-hidden">
        {photo && !photoFailed ? (
          <img
            src={photo}
            alt={`${getDisplayName(apt.name)} — ${apt.neighborhood}`}
            loading="lazy"
            decoding="async"
            onError={() => setPhotoFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="w-12 h-12 text-slate-300" />
          </div>
        )}

        {/* Blur overlay for non-leads */}
        {!isLead && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
            <div className="bg-white/90 rounded-full p-2">
              <Lock className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-white text-xs font-medium drop-shadow">Submit info to unlock</p>
          </div>
        )}

        <Badge className="absolute top-2 left-2 bg-blue-600 text-white text-xs">
          {getDisplayName(apt.name)}
        </Badge>
        {apt.special && (
          <Badge className="absolute bottom-2 left-2 bg-amber-500 text-white text-xs max-w-[90%] truncate">
            Special
          </Badge>
        )}

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-2 transition-colors"
          title={isFavorited ? "Remove from favorites" : "Add to favorites"}
          aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={isFavorited}
        >
          <Heart
            className={`w-5 h-5 ${
              isFavorited
                ? "fill-red-500 text-red-500"
                : "text-gray-400 hover:text-red-500"
            }`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {matchTier && (
          <div className="flex items-center gap-2 mb-2">
            <Badge
              className={
                matchTier === 'great'
                  ? 'bg-emerald-600 text-white text-[10px] px-1.5'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-1.5'
              }
            >
              {matchTier === 'great' ? 'Great match' : 'Good match'}
            </Badge>
            {match && match.reasons.length > 0 && (
              <span className="text-[11px] text-emerald-700 truncate">{match.reasons.join(' · ')}</span>
            )}
          </div>
        )}
        <h3 className="font-semibold text-slate-900 text-sm mb-1 truncate">{getDisplayName(apt.name)}</h3>
        <p className="text-xs text-slate-500 flex items-center gap-1 mb-2">
          <MapPin className="w-3 h-3 shrink-0" />
          {apt.neighborhood}
        </p>
        <p className="text-base font-bold text-blue-600 mb-3">
          {(() => {
            const { min, max } = getBedroomAwareRent(apt, bedroomFilter);
            return formatRent(min, max);
          })()}
        </p>
        {apt.availability && (
          <p className="text-xs text-slate-500 mb-3 line-clamp-1">{apt.availability}</p>
        )}

        {isLead ? (
          <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={(e) => { e.stopPropagation(); onViewDetails(); }}>
            View Details <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="w-full text-xs border-blue-200 text-blue-600 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); onLearnMore(); }}>
            <Eye className="w-3 h-3 mr-1" /> Learn More
          </Button>
        )}
      </div>
    </Card>
  );
}

function PhotoCarousel({ photos, name }: { photos: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  if (!photos.length) return (
    <div className="h-56 bg-slate-100 rounded-lg flex items-center justify-center">
      <Home className="w-16 h-16 text-slate-300" />
    </div>
  );
  return (
    <div className="relative h-56 rounded-lg overflow-hidden bg-slate-100">
      <img src={photos[idx]} alt={`${name} photo ${idx + 1} of ${photos.length}`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
      {photos.length > 1 && (
        <>
          <button
            onClick={() => setIdx(i => (i - 1 + photos.length) % photos.length)}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIdx(i => (i + 1) % photos.length)}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Go to photo ${i + 1}`}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/50'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ApartmentSearch() {
  const {
    qualificationData,
    hasQualified,
    isCheckingServer,
    setQualificationData,
    markQualified,
    setShowQualificationPrompt,
    showQualificationPrompt,
  } = useQualification();
  const { favorites, isFavorited, toggleFavorite } = useFavorites();
  const [selectedApartment, setSelectedApartment] = useState<ApartmentTeased | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [pendingApartment, setPendingApartment] = useState<ApartmentTeased | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showPinPreview, setShowPinPreview] = useState(false);
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const clustererRef = useRef<any>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);

  // Filters — initialized from the URL so a filtered view is a shareable
  // link (e.g. /search?area=Katy&beds=2) and survives refresh.
  const [initialFilters] = useState(() => decodeSearchFilters(window.location.search));
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(initialFilters.neighborhood);
  const [bedroomFilter, setBedroomFilter] = useState(initialFilters.bedrooms);
  // sliderRentRange is the live display value; committedRentRange drives the filters
  const [sliderRentRange, setSliderRentRange] = useState<[number, number]>(initialFilters.rentRange);
  const [committedRentRange, setCommittedRentRange] = useState<[number, number]>(initialFilters.rentRange);
  const [searchText, setSearchText] = useState(initialFilters.searchText);
  // Sort order for the listings panel
  const [sortBy, setSortBy] = useState<'recommended' | 'price-asc' | 'price-desc'>(initialFilters.sortBy);
  // Mobile view toggle: 'map' | 'list'
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list');

  // Debounce free-text search so the list and map markers aren't rebuilt on
  // every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState(initialFilters.searchText);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Keep the URL in sync with the active filters so the current view can be
  // shared or bookmarked. replaceState avoids polluting browser history.
  useEffect(() => {
    const qs = encodeSearchFilters({
      neighborhood: selectedNeighborhood,
      bedrooms: bedroomFilter,
      rentRange: committedRentRange,
      searchText: debouncedSearch,
      sortBy,
    });
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(window.history.state, '', url);
  }, [selectedNeighborhood, bedroomFilter, committedRentRange, debouncedSearch, sortBy]);

  // Incremental rendering of results; resets whenever the result set changes
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedSearch, selectedNeighborhood, bedroomFilter, committedRentRange, sortBy]);

  // The map is gated: visitors must complete the questionnaire AND leave
  // contact details before browsing. The prompt opens immediately on page
  // load and cannot be dismissed. We wait for the server session check so
  // returning clients aren't flashed with the prompt unnecessarily.
  useEffect(() => {
    if (!isCheckingServer && !hasQualified && !showQualificationPrompt) {
      setShowQualificationPrompt(true);
    }
  }, [isCheckingServer, hasQualified, showQualificationPrompt, setShowQualificationPrompt]);

  // Fetch the full inventory once and filter client-side: filters respond
  // instantly with no loading flicker, and the neighborhood dropdown keeps
  // every option (filtering server-side shrank the list to the selection).
  const { data: apartmentsData, isLoading, isError } = trpc.apartments.list.useQuery(
    undefined,
    { staleTime: 60_000 }
  );

  const apartments: ApartmentTeased[] = useMemo(
    () => (apartmentsData ?? []) as ApartmentTeased[],
    [apartmentsData]
  );

  // Structured filters (neighborhood / bedrooms / rent). Mirrors the
  // server's per-bedroom pricing rule: when a 1BR/2BR filter is active and
  // the listing has a price split for it, that price drives the rent range.
  const clientFiltered = useMemo(() => {
    const bedrooms = bedroomFilter ? parseInt(bedroomFilter) : null;
    const [minRent, maxRent] = committedRentRange;
    const maxIsUncapped = maxRent >= DEFAULT_RENT_RANGE[1];

    return apartments.filter(apt => {
      if (selectedNeighborhood && apt.neighborhood !== selectedNeighborhood) return false;

      if (bedrooms !== null) {
        // "4+" means four or more; every other option is an exact match
        if (bedrooms === 4 ? apt.bedrooms < 4 : apt.bedrooms !== bedrooms) return false;
      }

      const { min } = getBedroomAwareRent(apt, bedroomFilter);
      const price = typeof min === 'string' ? parseFloat(min) : min;
      const hasPrice = Number.isFinite(price) && price > 0;
      // "Pricing by request" listings stay visible unless a minimum is set
      if (hasPrice) {
        if (price < minRent) return false;
        if (!maxIsUncapped && price > maxRent) return false;
      } else if (minRent > 0) {
        return false;
      }
      return true;
    });
  }, [apartments, selectedNeighborhood, bedroomFilter, committedRentRange]);

  // Precomputed search index: one lowercase haystack per listing, rebuilt
  // only when the structured filters change instead of re-deriving every
  // field on every keystroke. Includes bedroom synonyms so "studio",
  // "2 bed", or "1br" all match.
  const searchIndex = useMemo(
    () =>
      clientFiltered.map(apt => ({
        apt,
        haystack: [
          apt.neighborhood,
          apt.description,
          apt.special,
          apt.availability,
          formatBedrooms(apt.bedrooms),
          `${apt.bedrooms}br ${apt.bedrooms} bed ${apt.bedrooms} beds ${apt.bedrooms} bedroom`,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      })),
    [clientFiltered]
  );

  // Every search term must match (AND semantics), so "katy special" finds
  // Katy listings that currently have a move-in special.
  // Memoized so the array identity is stable between renders — the marker
  // effect below depends on it, and an unstable reference caused all map
  // markers/clusters to be torn down and rebuilt on every render.
  const filtered = useMemo(() => {
    const terms = debouncedSearch.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return clientFiltered;
    return searchIndex
      .filter(({ haystack }) => terms.every(term => haystack.includes(term)))
      .map(entry => entry.apt);
  }, [clientFiltered, searchIndex, debouncedSearch]);

  // Match scores against the visitor's questionnaire answers; null until
  // they've completed it. Keyed by listing id so cards and the sort below
  // share one computation over the full inventory.
  const matchById = useMemo(() => {
    if (!qualificationData) return null;
    const map = new Map<number, MatchResult>();
    apartments.forEach(apt => map.set(apt.id, getMatchResult(apt, qualificationData)));
    return map;
  }, [apartments, qualificationData]);

  // Sorted view for the listings panel only — the map doesn't care about
  // order, so markers keep using `filtered` and aren't rebuilt on sort.
  const sorted = useMemo(() => {
    if (sortBy === 'recommended') {
      // Once the questionnaire is done, "Recommended" means ranked by how
      // well each listing matches their budget, bedrooms, and areas.
      // Stable sort: ties keep the server's original order.
      if (!matchById) return filtered;
      return filtered
        .map((apt, index) => ({ apt, index, score: matchById.get(apt.id)?.score ?? 0 }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(entry => entry.apt);
    }
    const direction = sortBy === 'price-asc' ? 1 : -1;
    const priceOf = (apt: ApartmentTeased): number | null => {
      const { min } = getBedroomAwareRent(apt, bedroomFilter);
      const value = typeof min === 'string' ? parseFloat(min) : min;
      return Number.isFinite(value) && value > 0 ? value : null;
    };
    return [...filtered].sort((a, b) => {
      const priceA = priceOf(a);
      const priceB = priceOf(b);
      // Listings without pricing always sort last
      if (priceA === null) return priceB === null ? 0 : 1;
      if (priceB === null) return -1;
      return (priceA - priceB) * direction;
    });
  }, [filtered, sortBy, bedroomFilter, matchById]);

  const neighborhoods = useMemo(
    () => Array.from(new Set(apartments.map(a => a.neighborhood))).sort(),
    [apartments]
  );

  // Bring the selected listing's card into view, expanding the paginated
  // list first if the card isn't rendered yet (e.g. selected via map pin).
  useEffect(() => {
    if (!selectedApartment) return;
    const index = sorted.findIndex(a => a.id === selectedApartment.id);
    if (index === -1) return;
    if (index >= visibleCount) {
      setVisibleCount(Math.ceil((index + 1) / PAGE_SIZE) * PAGE_SIZE);
      return; // re-runs after the expanded list renders
    }
    document
      .getElementById(`apt-card-${selectedApartment.id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedApartment, sorted, visibleCount]);

  const activeFilterCount =
    (selectedNeighborhood ? 1 : 0) +
    (bedroomFilter ? 1 : 0) +
    (committedRentRange[0] !== DEFAULT_RENT_RANGE[0] || committedRentRange[1] !== DEFAULT_RENT_RANGE[1] ? 1 : 0) +
    (searchText.trim() ? 1 : 0);

  // ── Map markers with clustering ──────────────────────────────────────────────────────────────
  const placeMarkers = useCallback((map: google.maps.Map, apts: ApartmentTeased[], activeBrFilter: string) => {
    // Clear old markers
    markersRef.current.forEach(m => { m.map = null; });
    markersRef.current = [];

    // Clear clusterer
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }

    const newMarkers: google.maps.marker.AdvancedMarkerElement[] = [];

    apts.forEach(apt => {
      const { lat, lng } = getCoords(apt);

      // Custom pin element
      const pin = document.createElement('div');
      pin.style.cssText = `
        background: #2563eb;
        color: white;
        border: 2px solid white;
        border-radius: 20px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 700;
        font-family: system-ui, sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        white-space: nowrap;
        transition: transform 0.15s, background 0.15s;
      `;
      // Use bedroom-specific price on pin when a bedroom filter is active
      const brNum = parseInt(activeBrFilter);
      let pinPrice: number | null = null;
      if (!isNaN(brNum)) {
        if (brNum === 1 && apt.price1brMin != null) pinPrice = apt.price1brMin;
        else if (brNum === 2 && apt.price2brMin != null) pinPrice = apt.price2brMin;
      }
      if (pinPrice == null) {
        const raw = apt.rentMin;
        pinPrice = typeof raw === 'string' ? parseFloat(raw) : raw;
      }
      pin.textContent = Number.isFinite(pinPrice) && pinPrice > 0
        ? `$${pinPrice >= 1000 ? (pinPrice / 1000).toFixed(1) + 'k' : pinPrice}`
        : 'Info';

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat, lng },
        map,
        content: pin,
        title: getDisplayName(apt.name),
      });

      marker.addListener('click', () => {
        // Highlight selected marker
        markersRef.current.forEach(m => {
          const el = m.content as HTMLElement;
          if (el) { el.style.background = '#2563eb'; el.style.transform = 'scale(1)'; }
        });
        pin.style.background = '#1d4ed8';
        pin.style.transform = 'scale(1.15)';

        // Always show the teaser preview card first (for both visitors and
        // leads); a separate effect scrolls the matching card into view.
        setSelectedApartment(apt);
        setShowPinPreview(true);
        setMobileView('list');
      });

      newMarkers.push(marker);
      markersRef.current.push(marker);
    });

    // Setup clustering
    if (newMarkers.length > 0) {
      loadMarkerClustererLibrary().then(success => {
        if (success && mapRef.current) {
          clustererRef.current = createMarkerClusterer(mapRef.current, newMarkers as any);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (mapRef.current && filtered.length > 0) {
      placeMarkers(mapRef.current, filtered, bedroomFilter);
    }
  }, [filtered, placeMarkers, bedroomFilter]);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
    if (filtered.length > 0) {
      placeMarkers(map, filtered, bedroomFilter);
    }
  }, [filtered, placeMarkers, bedroomFilter]);

  // Fit map bounds to filtered apartments
  const fitMapBounds = useCallback(() => {
    if (!mapRef.current || filtered.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    filtered.forEach(apt => {
      const { lat, lng } = getCoords(apt);
      bounds.extend({ lat, lng });
    });

    mapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
  }, [filtered]);

  // Center map on selected apartment
  const centerOnSelected = useCallback(() => {
    if (!mapRef.current || !selectedApartment) return;
    const { lat, lng } = getCoords(selectedApartment);
    mapRef.current.panTo({ lat, lng });
    mapRef.current.setZoom(15);
  }, [selectedApartment]);

  const handleLearnMore = (apt: ApartmentTeased) => {
    setSelectedApartment(apt);
    setPendingApartment(apt);
    // The prompt collects preferences + contact info; once a client has
    // access, Learn More goes straight to the inquiry form for that listing.
    if (!hasQualified) {
      setShowQualificationPrompt(true);
    } else {
      setShowInquiryForm(true);
    }
  };

  const handleViewDetails = (apt: ApartmentTeased) => {
    setSelectedApartment(apt);
    setShowDetails(true);
  };

  const handleContactOwner = () => {
    setShowDetails(false);
    setShowInquiryForm(true);
  };

  // ── Saved-search alerts ──
  // Leads can save the current filters; a daily job emails them when new
  // listings match. Saved state resets when the filters change so the same
  // visitor can save a different search.
  const createSavedSearch = trpc.savedSearches.create.useMutation();
  const [alertsSaved, setAlertsSaved] = useState(false);
  const [alertsError, setAlertsError] = useState('');
  useEffect(() => {
    setAlertsSaved(false);
    setAlertsError('');
  }, [selectedNeighborhood, bedroomFilter, committedRentRange, debouncedSearch]);

  const handleSaveSearch = async () => {
    setAlertsError('');
    try {
      await createSavedSearch.mutateAsync({
        filters: {
          neighborhood: selectedNeighborhood || undefined,
          bedrooms: (bedroomFilter || undefined) as '0' | '1' | '2' | '3' | '4' | undefined,
          minRent: committedRentRange[0] > 0 ? committedRentRange[0] : undefined,
          maxRent: committedRentRange[1] < DEFAULT_RENT_RANGE[1] ? committedRentRange[1] : undefined,
          searchText: debouncedSearch.trim() || undefined,
        },
      });
      setAlertsSaved(true);
    } catch (e) {
      setAlertsError(
        e instanceof Error && e.message
          ? e.message
          : 'Could not save this search. Please try again.'
      );
    }
  };

  const resetFilters = () => {
    setSelectedNeighborhood('');
    setBedroomFilter('');
    setSliderRentRange(DEFAULT_RENT_RANGE);
    setCommittedRentRange(DEFAULT_RENT_RANGE);
    setSearchText('');
    setSortBy('recommended');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Mandatory preferences + contact prompt (submits the inquiry itself) */}
      <QualificationPrompt
        isOpen={showQualificationPrompt}
        onComplete={(data) => {
          setQualificationData(data);
          markQualified();
          setShowQualificationPrompt(false);
        }}
        neighborhoods={neighborhoods}
        apartment={pendingApartment ? { id: pendingApartment.id.toString(), name: getDisplayName(pendingApartment.name) } : null}
        initialData={qualificationData}
      />
      {/* Top Nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663501304397/4gMGD9qetV63jA9Ts6DXxD/habitat-logo_3360fdb4.png"
                alt="Habitat Apartment Locators"
                className="h-8 w-auto"
              />
            </div>
          </Link>

          {/* Search bar */}
          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Search area, beds, special..."
              aria-label="Search listings by area, bedrooms, or special"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="pl-9 h-9 text-sm [&::-webkit-search-cancel-button]:hidden"
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(v => !v)}
            className="gap-2 shrink-0"
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge className="bg-blue-600 text-white h-5 min-w-5 px-1.5 justify-center text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          {!hasQualified && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              onClick={() => setShowQualificationPrompt(true)}
            >
              <Lock className="w-3 h-3 mr-1" /> Get Full Access
            </Button>
          )}
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="border-t border-slate-100 bg-white px-4 py-4 shadow-sm">
            <div className="max-w-7xl mx-auto space-y-4">
              {/* Quick filter buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Quick Filters</label>
                <div className="flex flex-wrap gap-2">
                  {([['0', 'Studio'], ['1', '1 Bed'], ['2', '2 Beds'], ['3', '3 Beds']] as const).map(([value, label]) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={bedroomFilter === value ? 'default' : 'outline'}
                      className="text-xs h-8"
                      onClick={() => setBedroomFilter(bedroomFilter === value ? '' : value)}
                    >
                      {label}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant={committedRentRange[1] <= 1500 ? 'default' : 'outline'}
                    className="text-xs h-8"
                    onClick={() => { const v = committedRentRange[1] <= 1500 ? DEFAULT_RENT_RANGE : [0, 1500] as [number, number]; setSliderRentRange(v); setCommittedRentRange(v); }}
                    title={bedroomFilter === '1' ? '1BR under $1,500/mo' : bedroomFilter === '2' ? '2BR under $1,500/mo' : 'Under $1,500/mo'}
                  >
                    {bedroomFilter === '1' ? '1BR < $1.5k' : bedroomFilter === '2' ? '2BR < $1.5k' : 'Under $1.5k'}
                  </Button>
                  <Button
                    size="sm"
                    variant={committedRentRange[0] >= 2000 && committedRentRange[1] <= 3000 ? 'default' : 'outline'}
                    className="text-xs h-8"
                    onClick={() => { const v = committedRentRange[0] >= 2000 && committedRentRange[1] <= 3000 ? DEFAULT_RENT_RANGE : [2000, 3000] as [number, number]; setSliderRentRange(v); setCommittedRentRange(v); }}
                    title={bedroomFilter === '1' ? '1BR $2,000–$3,000/mo' : bedroomFilter === '2' ? '2BR $2,000–$3,000/mo' : '$2,000–$3,000/mo'}
                  >
                    {bedroomFilter === '1' ? '1BR $2k-$3k' : bedroomFilter === '2' ? '2BR $2k-$3k' : '$2k - $3k'}
                  </Button>
                </div>
              </div>

              {/* Per-bedroom price range hint */}
              {(bedroomFilter === '1' || bedroomFilter === '2') && (() => {
                const isOneBr = bedroomFilter === '1';
                const isPrice = (p: number | null | undefined): p is number => typeof p === 'number' && p > 0;
                const prices = filtered
                  .map(a => (isOneBr ? a.price1brMin : a.price2brMin))
                  .filter(isPrice);
                if (prices.length === 0) return null;
                const lo = Math.min(...prices);
                const hi = Math.max(...filtered
                  .map(a => (isOneBr ? a.price1brMax ?? a.price1brMin : a.price2brMax ?? a.price2brMin))
                  .filter(isPrice));
                return (
                  <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-3 py-1.5">
                    <span className="font-semibold">{bedroomFilter === '1' ? '1 BR' : '2 BR'} range in results:</span>
                    <span>${lo.toLocaleString()} – ${hi.toLocaleString()}/mo</span>
                    <span className="text-blue-400">({prices.length} listings with pricing data)</span>
                  </div>
                );
              })()}

              {/* Advanced filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">Neighborhood</label>
                  <Select
                    value={selectedNeighborhood || '__all__'}
                    onValueChange={v => setSelectedNeighborhood(v === '__all__' ? '' : v)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="All areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All areas</SelectItem>
                      {neighborhoods.map(n => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">Bedrooms</label>
                  <Select
                    value={bedroomFilter || '__any__'}
                    onValueChange={v => setBedroomFilter(v === '__any__' ? '' : v)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any__">Any</SelectItem>
                      <SelectItem value="0">Studio</SelectItem>
                      <SelectItem value="1">1 Bed</SelectItem>
                      <SelectItem value="2">2 Beds</SelectItem>
                      <SelectItem value="3">3 Beds</SelectItem>
                      <SelectItem value="4">4+ Beds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">
                    {bedroomFilter === '1' ? '1BR Rent' : bedroomFilter === '2' ? '2BR Rent' : bedroomFilter === '3' ? '3BR Rent' : 'Rent'}:{' '}
                    ${sliderRentRange[0].toLocaleString()} – {sliderRentRange[1] >= DEFAULT_RENT_RANGE[1] ? 'Any' : `$${sliderRentRange[1].toLocaleString()}/mo`}
                  </label>
                  <Slider
                    min={0}
                    max={15000}
                    step={100}
                    value={sliderRentRange}
                    onValueChange={v => setSliderRentRange(v as [number, number])}
                    onValueCommit={v => setCommittedRentRange(v as [number, number])}
                    className="w-full"
                    aria-label="Monthly rent range"
                  />
                </div>
              </div>

              {/* Filter actions */}
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs h-8">
                  Clear All
                </Button>
                <Button size="sm" onClick={() => setShowFilters(false)} className="text-xs h-8 bg-blue-600 hover:bg-blue-700">
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Mobile map/list toggle — only visible on small screens */}
      <div className="flex lg:hidden items-center justify-center gap-1 bg-white border-b border-slate-200 px-4 py-2">
        <button
          onClick={() => setMobileView('list')}
          aria-pressed={mobileView === 'list'}
          className={cn(
            'flex-1 py-1.5 rounded-l-md text-xs font-semibold border transition-colors',
            mobileView === 'list'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
          )}
        >
          List
        </button>
        <button
          onClick={() => setMobileView('map')}
          aria-pressed={mobileView === 'map'}
          className={cn(
            'flex-1 py-1.5 rounded-r-md text-xs font-semibold border-t border-b border-r transition-colors',
            mobileView === 'map'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
          )}
        >
          Map
        </button>
      </div>

      {/* Main layout: map left, listings right */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
        {/* Map panel */}
        <div className={cn('lg:flex-1 lg:h-full relative', mobileView === 'map' ? 'flex-1 h-full' : 'hidden lg:block')}>
          <MapView
            initialCenter={{ lat: 29.7604, lng: -95.3698 }}
            initialZoom={10}
            onMapReady={handleMapReady}
          />

          {/* Loading overlay until the Google Maps script initialises */}
          {!mapReady && (
            <div className="absolute inset-0 z-10 bg-slate-100 flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <p className="text-sm text-slate-500 mt-2">Loading map...</p>
              </div>
            </div>
          )}

          {/* Map controls */}
          <div className="absolute bottom-6 right-4 flex flex-col gap-2 z-20">
            <Button
              size="sm"
              variant="outline"
              className="h-10 w-10 p-0 bg-white hover:bg-slate-50 shadow-md"
              onClick={fitMapBounds}
              title="Fit all listings in view"
              aria-label="Fit all listings in view"
            >
              <Compass className="w-4 h-4" />
            </Button>
            {selectedApartment && (
              <Button
                size="sm"
                variant="outline"
                className="h-10 w-10 p-0 bg-white hover:bg-slate-50 shadow-md"
                onClick={centerOnSelected}
                title="Center on selected listing"
                aria-label="Center map on selected listing"
              >
                <MapPin className="w-4 h-4 text-blue-600" />
              </Button>
            )}
          </div>

          {/* Results count badge */}
          <div className="absolute top-4 left-4 z-20">
            <Badge className="bg-white text-slate-900 shadow-md border border-slate-200">
              {isLoading ? 'Loading...' : `${filtered.length} listing${filtered.length !== 1 ? 's' : ''}`}
            </Badge>
          </div>
        </div>

        {/* Listings panel */}
        <div className={cn('w-full lg:w-96 xl:w-[420px] bg-white border-l border-slate-200 flex flex-col overflow-hidden', mobileView === 'list' ? 'flex' : 'hidden lg:flex')}>
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-semibold text-slate-900 text-sm">
                {isLoading ? 'Loading...' : `${filtered.length} listing${filtered.length !== 1 ? 's' : ''}`}
              </h2>
              {sortBy === 'recommended' && matchById && !isLoading && (
                <p className="text-[11px] text-slate-400">Ranked by your preferences</p>
              )}
              {activeFilterCount > 0 && (
                <button onClick={resetFilters} className="text-xs text-blue-600 mt-0.5 hover:underline">
                  {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active — clear
                </button>
              )}
            </div>
            <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Sort listings">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended">Recommended</SelectItem>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Saved-search alerts */}
          {hasQualified && !isLoading && !isError && (
            <div className="px-4 py-2 border-b border-slate-100 shrink-0">
              {alertsSaved ? (
                <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5 shrink-0" />
                  Alerts on — we'll email you when new listings match this search.
                </p>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8 border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={handleSaveSearch}
                  disabled={createSavedSearch.isPending}
                >
                  <Bell className="w-3.5 h-3.5 mr-1.5" />
                  {createSavedSearch.isPending ? 'Saving...' : 'Email me new matches for this search'}
                </Button>
              )}
              {alertsError && <p className="text-xs text-red-600 mt-1">{alertsError}</p>}
            </div>
          )}

          {/* Listings scroll area */}
          <div ref={listScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-44 w-full" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </Card>
              ))
            ) : isError ? (
              <div className="text-center py-16">
                <p className="text-slate-500 text-sm font-medium">Unable to load listings right now.</p>
                <p className="text-slate-400 text-xs mt-1">Please check your connection and try again.</p>
              </div>
            ) : sorted.length === 0 ? (
              <div className="text-center py-16">
                <MapPin className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 text-sm font-medium">No listings match your filters</p>
                <Button variant="ghost" size="sm" onClick={resetFilters} className="mt-2 text-blue-600">
                  Clear filters
                </Button>
              </div>
            ) : (
              <>
                {sorted.slice(0, visibleCount).map(apt => (
                  <ApartmentCard
                    key={apt.id}
                    id={`apt-card-${apt.id}`}
                    apt={apt}
                    isLead={hasQualified}
                    bedroomFilter={bedroomFilter}
                    match={matchById?.get(apt.id)}
                    onLearnMore={() => handleLearnMore(apt)}
                    onViewDetails={() => handleViewDetails(apt)}
                    isSelected={selectedApartment?.id === apt.id}
                    isFavorited={isFavorited(apt.id.toString())}
                    onToggleFavorite={() => toggleFavorite({
                      apartmentId: apt.id.toString(),
                      apartmentName: getDisplayName(apt.name),
                      neighborhood: apt.neighborhood,
                      rentMin: typeof apt.rentMin === 'string' ? parseInt(apt.rentMin) : apt.rentMin,
                      rentMax: typeof apt.rentMax === 'string' ? parseInt(apt.rentMax) : apt.rentMax || undefined,
                      bedrooms: apt.bedrooms,
                    })}
                  />
                ))}
                {sorted.length > visibleCount && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setVisibleCount(count => count + PAGE_SIZE)}
                  >
                    Show {Math.min(PAGE_SIZE, sorted.length - visibleCount)} more of {sorted.length - visibleCount} remaining
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Map Pin Teaser Preview Card ── */}
      <Dialog open={showPinPreview} onOpenChange={setShowPinPreview}>
        <DialogContent className="max-w-sm">
          {selectedApartment && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base flex items-center gap-2">
                  {getDisplayName(selectedApartment.name)}
                  {(() => {
                    const match = matchById?.get(selectedApartment.id);
                    const tier = match ? getMatchTier(match.score) : null;
                    if (!tier) return null;
                    return (
                      <Badge
                        className={
                          tier === 'great'
                            ? 'bg-emerald-600 text-white text-[10px] px-1.5'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-1.5'
                        }
                      >
                        {tier === 'great' ? 'Great match' : 'Good match'}
                      </Badge>
                    );
                  })()}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />{selectedApartment.neighborhood} area
                </DialogDescription>
              </DialogHeader>

              {/* Teased photo — blurred for visitors */}
              <div className="relative h-40 rounded-lg overflow-hidden bg-slate-100 mb-3">
                {selectedApartment.photos?.[0] ? (
                  <img
                    src={selectedApartment.photos[0]}
                    alt={getDisplayName(selectedApartment.name)}
                    className={`w-full h-full object-cover transition-all duration-300 ${
                      !hasQualified ? 'blur-sm scale-105' : ''
                    }`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Home className="w-12 h-12 text-slate-300" />
                  </div>
                )}
                {!hasQualified && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
                    <Lock className="w-6 h-6 text-white mb-1" />
                    <span className="text-white text-xs font-semibold">Submit info to unlock details</span>
                  </div>
                )}
              </div>

              {/* Key stats */}
              <div className="flex items-center justify-around bg-slate-50 rounded-lg p-3 mb-3">
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-900">{formatBedrooms(selectedApartment.bedrooms)}</p>
                  <p className="text-xs text-slate-500">Floor plans</p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-900">{selectedApartment.bathrooms}</p>
                  <p className="text-xs text-slate-500">Baths</p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-center">
                  <p className="text-sm font-bold text-blue-600">{formatRent(selectedApartment.rentMin, selectedApartment.rentMax)}</p>
                  <p className="text-xs text-slate-500">Rent</p>
                </div>
              </div>

              {selectedApartment.special && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Current special</p>
                  <p className="text-sm font-medium text-amber-950">{selectedApartment.special}</p>
                </div>
              )}

              {/* Teased description */}
              {selectedApartment.description && (
                <p className={`text-sm text-slate-600 mb-3 leading-relaxed ${
                  !hasQualified ? 'line-clamp-2' : 'line-clamp-3'
                }`}>
                  {selectedApartment.description}
                </p>
              )}

              {/* CTA */}
              {hasQualified ? (
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setShowPinPreview(false);
                    setShowDetails(true);
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" /> View Full Details
                </Button>
              ) : (
                <>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 mb-2"
                    onClick={() => {
                      setShowPinPreview(false);
                      setPendingApartment(selectedApartment);
                      setShowQualificationPrompt(true);
                    }}
                  >
                    <Lock className="w-4 h-4 mr-2" /> Unlock Details
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowPinPreview(false)}
                  >
                    Close
                  </Button>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Full Details Modal ── */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedApartment && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{getDisplayName(selectedApartment.name)}</DialogTitle>
                <DialogDescription className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />{selectedApartment.neighborhood} area
                </DialogDescription>
              </DialogHeader>

              <PhotoCarousel photos={selectedApartment.photos ?? []} name={selectedApartment.name} />

              {/* Key stats */}
              <div className="grid grid-cols-4 gap-2 bg-slate-50 rounded-lg p-3">
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-900">{formatBedrooms(selectedApartment.bedrooms)}</p>
                  <p className="text-xs text-slate-500">Beds</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-900">{selectedApartment.bathrooms}</p>
                  <p className="text-xs text-slate-500">Baths</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-blue-600">{formatRent(selectedApartment.rentMin, selectedApartment.rentMax)}</p>
                  <p className="text-xs text-slate-500">Rent</p>
                </div>
                {formatSqft(selectedApartment) && (
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900">{formatSqft(selectedApartment)}</p>
                    <p className="text-xs text-slate-500">Size</p>
                  </div>
                )}
              </div>

              {/* Per-bedroom price breakdown */}
              {(selectedApartment.price1brMin || selectedApartment.price2brMin) && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">Pricing by bedroom</p>
                  <div className="flex flex-wrap gap-3">
                    {selectedApartment.price1brMin && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs bg-blue-100 text-blue-800 rounded px-1.5 py-0.5 font-medium">1 BR</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {formatRent(selectedApartment.price1brMin, selectedApartment.price1brMax ?? null)}
                        </span>
                      </div>
                    )}
                    {selectedApartment.price2brMin && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs bg-blue-100 text-blue-800 rounded px-1.5 py-0.5 font-medium">2 BR</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {formatRent(selectedApartment.price2brMin, selectedApartment.price2brMax ?? null)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedApartment.special && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Current special</p>
                  <p className="text-sm font-medium text-amber-950">{selectedApartment.special}</p>
                </div>
              )}

              {selectedApartment.description && (
                <p className="text-sm text-slate-600 leading-relaxed">{selectedApartment.description}</p>
              )}

              {selectedApartment.availability && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Availability</p>
                  <p className="text-sm text-blue-900">{selectedApartment.availability}</p>
                </div>
              )}

              {/* CTA */}
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setShowDetails(false);
                  setShowInquiryForm(true);
                }}
              >
                <MessageCircle className="w-4 h-4 mr-2" /> Request Property Info
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Inquiry Form Modal ── */}
      {showInquiryForm && selectedApartment && (
        <InquiryForm
          apartmentId={selectedApartment.id.toString()}
          apartmentName={getDisplayName(selectedApartment.name)}
          qualificationData={qualificationData ?? undefined}
          onClose={() => setShowInquiryForm(false)}
        />
      )}

    </div>
  );
}

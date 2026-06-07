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
  MapPin, Home, DollarSign, BedDouble, Bath, Lock, ArrowRight,
  Phone, Mail, ChevronLeft, ChevronRight, Search, SlidersHorizontal,
  X, Eye, MessageCircle, Heart, ZoomIn, ZoomOut, Compass
} from 'lucide-react';
import { MapView } from '@/components/Map';
import { InquiryForm } from '@/components/InquiryForm';
import { toast } from 'sonner';
import { Link } from 'wouter';
import { useFavorites } from '@/hooks/useFavorites';
import { useQualification } from '@/contexts/QualificationContext';
import { QualificationPrompt } from '@/components/QualificationPrompt';
import { loadMarkerClustererLibrary, createMarkerClusterer } from '@/lib/markerClusterer';

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

const DEFAULT_RENT_RANGE: [number, number] = [0, 15000];

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
}) {
  const photo = apt.photos?.[0];

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
        {photo ? (
          <img src={photo} alt={getDisplayName(apt.name)} className="w-full h-full object-cover" />
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
      <img src={photos[idx]} alt={`${name} ${idx + 1}`} className="w-full h-full object-cover" />
      {photos.length > 1 && (
        <>
          <button
            onClick={() => setIdx(i => (i - 1 + photos.length) % photos.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIdx(i => (i + 1) % photos.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
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
  const { qualificationData, hasQualified, setQualificationData, setShowQualificationPrompt, showQualificationPrompt } = useQualification();
  const { favorites, isFavorited, toggleFavorite } = useFavorites();
  const [selectedApartment, setSelectedApartment] = useState<ApartmentTeased | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [pendingApartment, setPendingApartment] = useState<ApartmentTeased | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showPinPreview, setShowPinPreview] = useState(false);
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const clustererRef = useRef<any>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);

  // Filters
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [bedroomFilter, setBedroomFilter] = useState('');
  // sliderRentRange is the live display value; committedRentRange drives the tRPC query
  const [sliderRentRange, setSliderRentRange] = useState<[number, number]>(DEFAULT_RENT_RANGE);
  const [committedRentRange, setCommittedRentRange] = useState<[number, number]>(DEFAULT_RENT_RANGE);
  const [searchText, setSearchText] = useState('');
  // Mobile view toggle: 'map' | 'list'
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list');

  // Show qualification prompt on first visit to /search
  useEffect(() => {
    if (!hasQualified && !showQualificationPrompt) {
      setShowQualificationPrompt(true);
    }
  }, [hasQualified, showQualificationPrompt]);

  const queryInput = useMemo(() => ({
    neighborhood: selectedNeighborhood && selectedNeighborhood !== '__all__' ? selectedNeighborhood : undefined,
    minBedrooms: bedroomFilter && bedroomFilter !== '__any__' ? parseInt(bedroomFilter) : undefined,
    maxBedrooms: bedroomFilter && bedroomFilter !== '__any__' ? parseInt(bedroomFilter) : undefined,
    minRent: committedRentRange[0],
    maxRent: committedRentRange[1],
  }), [selectedNeighborhood, bedroomFilter, committedRentRange]);

  const { data: apartmentsData, isLoading, isError } = trpc.apartments.list.useQuery(
    queryInput,
    { staleTime: 30_000 }
  );

  const apartments: ApartmentTeased[] = (apartmentsData ?? []) as ApartmentTeased[];

  const filtered = apartments.filter(apt => {
    if (!searchText) return true;
    const term = searchText.toLowerCase();
    return [
      apt.name,
      apt.neighborhood,
      apt.special,
      apt.availability,
      apt.description,
      apt.managedBy,
    ]
      .filter((value): value is string => Boolean(value))
      .some(value => value.toLowerCase().includes(term));
  });

  const neighborhoods = Array.from(new Set(apartments.map(a => a.neighborhood))).sort();

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

        // Always show the teaser preview card first (for both visitors and leads)
        setSelectedApartment(apt);
        setShowPinPreview(true);

        // On mobile, switch to list view and scroll to the matching card
        setMobileView('list');
        setTimeout(() => {
          const cardEl = document.getElementById(`apt-card-${apt.id}`);
          if (cardEl) cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
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
    // If not qualified, show qualification prompt first
    if (!hasQualified) {
      setShowQualificationPrompt(true);
    } else {
      // Open the real InquiryForm (replaces the old dead showLeadForm placeholder)
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

  const resetFilters = () => {
    setSelectedNeighborhood('');
    setBedroomFilter('');
    setSliderRentRange(DEFAULT_RENT_RANGE);
    setCommittedRentRange(DEFAULT_RENT_RANGE);
    setSearchText('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Qualification Prompt */}
      <QualificationPrompt
        isOpen={showQualificationPrompt}
        onComplete={(data) => {
          setQualificationData(data);
          setShowQualificationPrompt(false);
          // If there's a pending apartment, open the inquiry form
          if (pendingApartment) {
            setShowInquiryForm(true);
          }
        }}
        onSkip={() => setShowQualificationPrompt(false)}
        neighborhoods={Array.from(new Set(apartments.map(a => a.neighborhood))).sort()}
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
              placeholder="Search name, city, special..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {searchText && (
              <button onClick={() => setSearchText('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(v => !v)}
            className="gap-2 shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </Button>

          {hasQualified ? (
            <Badge className="bg-green-100 text-green-700 text-xs shrink-0">
              Qualified
            </Badge>
          ) : (
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
                  <Button
                    size="sm"
                    variant={bedroomFilter === '0' ? 'default' : 'outline'}
                    className="text-xs h-8"
                    onClick={() => setBedroomFilter(bedroomFilter === '0' ? '' : '0')}
                  >
                    Studio
                  </Button>
                  <Button
                    size="sm"
                    variant={bedroomFilter === '1' ? 'default' : 'outline'}
                    className="text-xs h-8"
                    onClick={() => setBedroomFilter(bedroomFilter === '1' ? '' : '1')}
                  >
                    1 Bed
                  </Button>
                  <Button
                    size="sm"
                    variant={bedroomFilter === '2' ? 'default' : 'outline'}
                    className="text-xs h-8"
                    onClick={() => setBedroomFilter(bedroomFilter === '2' ? '' : '2')}
                  >
                    2 Beds
                  </Button>
                  <Button
                    size="sm"
                    variant={bedroomFilter === '3' ? 'default' : 'outline'}
                    className="text-xs h-8"
                    onClick={() => setBedroomFilter(bedroomFilter === '3' ? '' : '3')}
                  >
                    3 Beds
                  </Button>
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
                const priceKey = bedroomFilter === '1' ? 'price1brMin' : 'price2brMin';
                const priceMaxKey = bedroomFilter === '1' ? 'price1brMax' : 'price2brMax';
                const prices = filtered
                  .map(a => (a as any)[priceKey])
                  .filter((p): p is number => typeof p === 'number' && p > 0);
                if (prices.length === 0) return null;
                const lo = Math.min(...prices);
                const hi = Math.max(...filtered.map(a => (a as any)[priceMaxKey] ?? (a as any)[priceKey]).filter((p): p is number => typeof p === 'number' && p > 0));
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
                  <Select value={selectedNeighborhood} onValueChange={setSelectedNeighborhood}>
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
                  <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
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
                    {bedroomFilter === '1' ? '1BR Max Rent' : bedroomFilter === '2' ? '2BR Max Rent' : bedroomFilter === '3' ? '3BR Max Rent' : 'Max Rent'}: ${sliderRentRange[1] >= 15000 ? 'Any' : sliderRentRange[1].toLocaleString() + '/mo'}
                  </label>
                  <Slider
                    min={0}
                    max={15000}
                    step={100}
                    value={sliderRentRange}
                    onValueChange={v => setSliderRentRange(v as [number, number])}
                    onValueCommit={v => setCommittedRentRange(v as [number, number])}
                    className="w-full"
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

          {/* Map controls */}
          <div className="absolute bottom-6 right-4 flex flex-col gap-2 z-20">
            <Button
              size="sm"
              variant="outline"
              className="h-10 w-10 p-0 bg-white hover:bg-slate-50 shadow-md"
              onClick={fitMapBounds}
              title="Fit all listings in view"
            >
              <Compass className="w-4 h-4" />
            </Button>
            {selectedApartment && (
              <Button
                size="sm"
                variant="outline"
                className="h-10 w-10 p-0 bg-white hover:bg-slate-50 shadow-md"
                onClick={centerOnSelected}
                title="Center on selected"
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
              {(selectedNeighborhood || bedroomFilter || searchText) && (
                <p className="text-xs text-blue-600 mt-0.5">Filters active</p>
              )}
            </div>
            {hasQualified && (
              <Badge className="bg-green-100 text-green-700 text-xs">
                Full access
              </Badge>
            )}
          </div>

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
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <MapPin className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 text-sm font-medium">No listings match your filters</p>
                <Button variant="ghost" size="sm" onClick={resetFilters} className="mt-2 text-blue-600">
                  Clear filters
                </Button>
              </div>
            ) : isError ? (
              <div className="text-center py-16">
                <p className="text-slate-500 text-sm font-medium">Unable to load listings right now.</p>
                <p className="text-slate-400 text-xs mt-1">Please check your connection and try again.</p>
              </div>
            ) : (
              filtered.map(apt => (
                <ApartmentCard
                  key={apt.id}
                  id={`apt-card-${apt.id}`}
                  apt={apt}
                  isLead={hasQualified}
                  bedroomFilter={bedroomFilter}
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
              ))
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
                <DialogTitle className="text-base">{getDisplayName(selectedApartment.name)}</DialogTitle>
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
                      !true ? 'blur-sm scale-105' : ''
                    }`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Home className="w-12 h-12 text-slate-300" />
                  </div>
                )}
                {!true && (
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
                  !true ? 'line-clamp-2' : 'line-clamp-3'
                }`}>
                  {selectedApartment.description}
                </p>
              )}

              {/* CTA */}
              {true ? (
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
                      setShowInquiryForm(true);
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
                <MessageCircle className="w-4 h-4 mr-2" /> Contact Owner
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

      {/* showLeadForm is no longer used — handleLearnMore now opens InquiryForm directly */}
    </div>
  );
}

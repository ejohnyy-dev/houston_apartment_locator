import { useState, useRef, useEffect, useCallback } from 'react';
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

function formatSqft(apt: ApartmentTeased): string | null {
  if (!apt.minSqft) return null;
  if (apt.maxSqft && apt.maxSqft !== apt.minSqft) {
    return `${apt.minSqft.toLocaleString()}-${apt.maxSqft.toLocaleString()} sqft`;
  }
  return `${apt.minSqft.toLocaleString()} sqft`;
}

function ApartmentCard({
  apt,
  isLead,
  onLearnMore,
  onViewDetails,
  isSelected,
  isFavorited,
  onToggleFavorite,
}: {
  apt: ApartmentTeased;
  isLead: boolean;
  onLearnMore: () => void;
  onViewDetails: () => void;
  isSelected: boolean;
  isFavorited: boolean;
  onToggleFavorite: () => void;
}) {
  const photo = apt.photos?.[0];

  return (
    <Card
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
          {formatRent(apt.rentMin, apt.rentMax)}
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
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [pendingApartment, setPendingApartment] = useState<ApartmentTeased | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showPinPreview, setShowPinPreview] = useState(false);
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const clustererRef = useRef<any>(null);

  // Filters
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [bedroomFilter, setBedroomFilter] = useState('');
  const [rentRange, setRentRange] = useState<[number, number]>(DEFAULT_RENT_RANGE);
  const [searchText, setSearchText] = useState('');

  // Show qualification prompt on first visit to /search
  useEffect(() => {
    if (!hasQualified && !showQualificationPrompt) {
      setShowQualificationPrompt(true);
    }
  }, [hasQualified, showQualificationPrompt, setShowQualificationPrompt]);

  const { data: apartmentsData, isLoading } = trpc.apartments.list.useQuery(
    {
      neighborhood: selectedNeighborhood && selectedNeighborhood !== '__all__' ? selectedNeighborhood : undefined,
      minBedrooms: bedroomFilter && bedroomFilter !== '__any__' ? parseInt(bedroomFilter) : undefined,
      maxBedrooms: bedroomFilter && bedroomFilter !== '__any__' ? parseInt(bedroomFilter) : undefined,
      minRent: rentRange[0],
      maxRent: rentRange[1],
    },
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
  const placeMarkers = useCallback((map: google.maps.Map, apts: ApartmentTeased[]) => {
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
      const rentMin = typeof apt.rentMin === 'string' ? parseFloat(apt.rentMin) : apt.rentMin;
      pin.textContent = Number.isFinite(rentMin) && rentMin > 0
        ? `$${Math.round(rentMin / 100) * 100 >= 1000 ? (rentMin / 1000).toFixed(1) + 'k' : rentMin}`
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
      placeMarkers(mapRef.current, filtered);
    }
  }, [filtered, placeMarkers]);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (filtered.length > 0) {
      placeMarkers(map, filtered);
    }
  }, [filtered, placeMarkers]);

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
    setShowLeadForm(true);
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
    setRentRange(DEFAULT_RENT_RANGE);
    setSearchText('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Qualification Prompt */}
      <QualificationPrompt
        isOpen={showQualificationPrompt && !hasQualified}
        onComplete={(data) => {
          setQualificationData(data);
          setShowQualificationPrompt(false);
        }}
        neighborhoods={Array.from(new Set(apartments.map(a => a.neighborhood))).sort()}
      />
      {/* Top Nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <Home className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-slate-900 text-lg hidden sm:block">TX Apt Finder</span>
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

          {true ? (
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                E
              </div>
              <span className="text-sm text-slate-700 hidden sm:block">Eric</span>
            </div>
          ) : (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              onClick={() => setShowLeadForm(true)}
            >
              <Lock className="w-3 h-3 mr-1" /> Unlock Access
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
                    variant={rentRange[1] <= 1500 ? 'default' : 'outline'}
                    className="text-xs h-8"
                    onClick={() => setRentRange(rentRange[1] <= 1500 ? DEFAULT_RENT_RANGE : [0, 1500])}
                  >
                    Under $1.5k
                  </Button>
                  <Button
                    size="sm"
                    variant={rentRange[0] >= 2000 && rentRange[1] <= 3000 ? 'default' : 'outline'}
                    className="text-xs h-8"
                    onClick={() => setRentRange(rentRange[0] >= 2000 && rentRange[1] <= 3000 ? DEFAULT_RENT_RANGE : [2000, 3000])}
                  >
                    $2k - $3k
                  </Button>
                </div>
              </div>

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
                    Max Rent: ${rentRange[1].toLocaleString()}/mo
                  </label>
                  <Slider
                    min={0}
                    max={15000}
                    step={100}
                    value={rentRange}
                    onValueChange={v => setRentRange(v as [number, number])}
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

      {/* Main layout: map left, listings right */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
        {/* Map panel */}
        <div className="lg:flex-1 h-64 lg:h-full relative">
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
        <div className="w-full lg:w-96 xl:w-[420px] bg-white border-l border-slate-200 flex flex-col overflow-hidden">
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
            {true && (
              <Badge className="bg-green-100 text-green-700 text-xs">
                Full access
              </Badge>
            )}
          </div>

          {/* Listings scroll area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
            ) : (
              filtered.map(apt => (
                <ApartmentCard
                  key={apt.id}
                  apt={apt}
                  isLead={true}
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
                      setShowLeadForm(true);
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

      {/* ── Lead Form Modal ── */}
      {showLeadForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-2">Unlock Full Access</h2>
              <p className="text-sm text-slate-600 mb-4">Submit your information to view detailed listings and contact information.</p>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setShowLeadForm(false);
                  toast.success('Feature coming soon');
                }}
              >
                Continue
              </Button>
              <Button
                variant="ghost"
                className="w-full mt-2"
                onClick={() => setShowLeadForm(false)}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

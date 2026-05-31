import { useState, useEffect, useRef, useCallback } from 'react';
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
  X, Eye, MessageCircle
} from 'lucide-react';
import { MapView } from '@/components/Map';
import { QualificationPrompt, type QualificationData } from '@/components/QualificationPrompt';
import { useLead } from '@/contexts/LeadContext';
import { toast } from 'sonner';
import { Link } from 'wouter';

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
}: {
  apt: ApartmentTeased;
  isLead: boolean;
  onLearnMore: () => void;
  onViewDetails: () => void;
  isSelected: boolean;
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
          <img src={photo} alt={apt.name} className="w-full h-full object-cover" />
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
          {formatBedrooms(apt.bedrooms)} · {apt.bathrooms} Bath
        </Badge>
        {apt.special && (
          <Badge className="absolute bottom-2 left-2 bg-amber-500 text-white text-xs max-w-[90%] truncate">
            Special
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-slate-900 text-sm mb-1 truncate">{apt.name}</h3>
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
  const { lead, setLead, isLeadAuthenticated } = useLead();
  const [selectedApartment, setSelectedApartment] = useState<ApartmentTeased | null>(null);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showPersonalizedResults, setShowPersonalizedResults] = useState(false); // txaptfinder.com post-submission experience (vault spec)
  const [showDetails, setShowDetails] = useState(false);
  const [pendingApartment, setPendingApartment] = useState<ApartmentTeased | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false); // New mobile/desktop friendly filter sheet
  const [showPinPreview, setShowPinPreview] = useState(false);

  // Amenities for multi-select (B)
  const { data: allAmenities = [] } = trpc.amenities.list.useQuery();
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<number[]>([]);

  // Saved searches for leads (C)
  const { data: savedSearches = [], refetch: refetchSavedSearches } = trpc.savedSearches.list.useQuery(undefined, {
    enabled: isLeadAuthenticated,
  });

  const createSavedSearchMutation = trpc.savedSearches.create.useMutation({
    onSuccess: () => {
      refetchSavedSearches();
      toast.success("Search saved!");
    },
  });

  const deleteSavedSearchMutation = trpc.savedSearches.delete.useMutation({
    onSuccess: () => refetchSavedSearches(),
  });

  // === Staged qualification flow (ported from innovations work) ===
  const [showQualificationPrompt, setShowQualificationPrompt] = useState(false);
  const [qualification, setQualification] = useState<QualificationData | null>(null);
  const [hasShownQualPrompt, setHasShownQualPrompt] = useState(false);

  // Refs to avoid stale closures in marker listeners
  const qualificationRef = useRef<QualificationData | null>(null);
  const hasShownQualPromptRef = useRef(false);

  useEffect(() => { qualificationRef.current = qualification; }, [qualification]);
  useEffect(() => { hasShownQualPromptRef.current = hasShownQualPrompt; }, [hasShownQualPrompt]);

  // Mobile listings sheet
  const [showMobileListings, setShowMobileListings] = useState(false);

  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  // Filters
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [bedroomFilter, setBedroomFilter] = useState('');
  const [rentRange, setRentRange] = useState<[number, number]>(DEFAULT_RENT_RANGE);
  const [searchText, setSearchText] = useState('');

  // New improved renter filters (ported from development work)
  const [bathroomFilter, setBathroomFilter] = useState('');
  const [showSpecialsOnly, setShowSpecialsOnly] = useState(false);
  const [sqftRange, setSqftRange] = useState<[number, number]>([0, 3000]);

  const { data: apartmentsData, isLoading } = trpc.apartments.list.useQuery(
    {
      neighborhood: selectedNeighborhood || undefined,
      minBedrooms: bedroomFilter ? parseInt(bedroomFilter) : undefined,
      maxBedrooms: bedroomFilter ? parseInt(bedroomFilter) : undefined,
      minRent: rentRange[0],
      maxRent: rentRange[1],
      // New filters
      minBathrooms: bathroomFilter ? parseFloat(bathroomFilter) : undefined,
      maxBathrooms: bathroomFilter ? parseFloat(bathroomFilter) : undefined,
      hasSpecial: showSpecialsOnly || undefined,
      minSqft: sqftRange[0] > 0 ? sqftRange[0] : undefined,
      maxSqft: sqftRange[1] < 3000 ? sqftRange[1] : undefined,
      amenityIds: selectedAmenityIds.length > 0 ? selectedAmenityIds : undefined,
    },
    { staleTime: 30_000 }
  );

  const recordInteractionMutation = trpc.leads.recordInteraction.useMutation();

  const apartments: ApartmentTeased[] = (apartmentsData ?? []) as ApartmentTeased[];

  const filtered = apartments.filter(apt => {
    const term = searchText.trim().toLowerCase();
    if (!term) return true;
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

  const neighborhoods = Array.from(new Set(apartments.map(a => a.neighborhood).filter(Boolean))).sort();

  // ── Map markers ──────────────────────────────────────────────────────────────
  const placeMarkers = useCallback((map: google.maps.Map, apts: ApartmentTeased[]) => {
    // Clear old markers
    markersRef.current.forEach((m) => {
      if (typeof (m as any).setMap === "function") (m as any).setMap(null);
    });
    markersRef.current = [];

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
        title: apt.name,
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

      markersRef.current.push(marker);
    });
  }, [isLeadAuthenticated, lead, recordInteractionMutation]);

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

  const handleLearnMore = (apt: ApartmentTeased) => {
    setSelectedApartment(apt);
    setPendingApartment(apt);
    setShowLeadForm(true);
  };

  const handleViewDetails = (apt: ApartmentTeased) => {
    setSelectedApartment(apt);
    setShowDetails(true);
    if (lead) {
      recordInteractionMutation.mutate({
        leadId: lead.id,
        apartmentId: apt.id,
        interactionType: 'view',
      });
    }
  };

  const handleLeadSuccess = (newLead: { 
    id: number; 
    name: string; 
    email: string; 
    phone: string;
    moveTimeline?: string;
  }) => {
    setLead(newLead);
    setShowLeadForm(false);

    // Improved success per vault spec (txaptfinder.com)
    const firstName = newLead.name.split(' ')[0];
    toast.success(`Thanks, ${firstName}! You now have full access.`, {
      description: "We've noted your preferences. Strong matches are highlighted below.",
    });

    // Trigger post-submission personalized experience (vault spec)
    setShowPersonalizedResults(true);

    if (pendingApartment) {
      setSelectedApartment(pendingApartment);
      setShowDetails(true);
      setPendingApartment(null);
    }
  };

  const handleContactOwner = () => {
    if (selectedApartment && lead) {
      recordInteractionMutation.mutate({
        leadId: lead.id,
        apartmentId: selectedApartment.id,
        interactionType: 'inquiry',
      });
    }
    toast.success('Your inquiry has been recorded. The owner will contact you shortly!');
  };

  const resetFilters = () => {
    setSelectedNeighborhood('');
    setBedroomFilter('');
    setRentRange(DEFAULT_RENT_RANGE);
    setSearchText('');
    // Reset new filters
    setBathroomFilter('');
    setShowSpecialsOnly(false);
    setSqftRange([0, 3000]);
    setSelectedAmenityIds([]);
  };

  // === Apply qualification (ported) ===
  const applyQualification = (q: QualificationData) => {
    setQualification(q);
    if (q.bedrooms) {
      const bedMap: Record<string, string> = { 'Studio': '0', '1 Bedroom': '1', '2 Bedrooms': '2', '3+ Bedrooms': '3' };
      setBedroomFilter(bedMap[q.bedrooms] ?? '');
    }
    if (q.budget) {
      const budgetToRange: Record<string, [number, number]> = {
        "Under $1,000": [0, 1000], "$1,000 – $1,500": [1000, 1500],
        "$1,500 – $2,000": [1500, 2000], "$2,000 – $2,500": [2000, 2500],
        "$2,500 – $3,000": [2500, 3000], "$3,000+": [3000, 15000],
      };
      const range = budgetToRange[q.budget]; if (range) setRentRange(range);
    }
    if (q.preferredAreas.length > 0) setSelectedNeighborhood(q.preferredAreas[0]);
    toast.success("Got it — filtering the map to your best matches.");
  };

  // Active filter chips helper
  const getActiveFilters = () => {
    const chips: { label: string; onRemove: () => void }[] = [];

    if (selectedNeighborhood) {
      chips.push({ label: selectedNeighborhood, onRemove: () => setSelectedNeighborhood('') });
    }
    if (bedroomFilter) {
      const label = bedroomFilter === '0' ? 'Studio' : `${bedroomFilter}+ Beds`;
      chips.push({ label, onRemove: () => setBedroomFilter('') });
    }
    if (bathroomFilter) {
      chips.push({ label: `${bathroomFilter}+ Baths`, onRemove: () => setBathroomFilter('') });
    }
    if (showSpecialsOnly) {
      chips.push({ label: 'Specials Only', onRemove: () => setShowSpecialsOnly(false) });
    }
    if (rentRange[0] > 0 || rentRange[1] < 15000) {
      chips.push({
        label: `$${rentRange[0] / 1000}k–$${rentRange[1] / 1000}k`,
        onRemove: () => setRentRange(DEFAULT_RENT_RANGE),
      });
    }
    if (sqftRange[0] > 0 || sqftRange[1] < 3000) {
      chips.push({
        label: `${sqftRange[0]}–${sqftRange[1]} sqft`,
        onRemove: () => setSqftRange([0, 3000]),
      });
    }
    if (searchText) {
      chips.push({ label: `"${searchText}"`, onRemove: () => setSearchText('') });
    }
    if (selectedAmenityIds.length > 0) {
      const names = allAmenities
        .filter(a => selectedAmenityIds.includes(a.id))
        .map(a => a.name)
        .join(', ');
      chips.push({
        label: names.length > 25 ? `${names.slice(0, 22)}...` : names,
        onRemove: () => setSelectedAmenityIds([]),
      });
    }
    return chips;
  };

  const activeFilters = getActiveFilters();

  // Helper to get current filters as object for saving
  const getCurrentFiltersForSave = () => ({
    neighborhood: selectedNeighborhood || undefined,
    minRent: rentRange[0] > 0 ? rentRange[0] : undefined,
    maxRent: rentRange[1] < 15000 ? rentRange[1] : undefined,
    minBedrooms: bedroomFilter ? parseInt(bedroomFilter) : undefined,
    maxBedrooms: bedroomFilter ? parseInt(bedroomFilter) : undefined,
    minBathrooms: bathroomFilter ? parseFloat(bathroomFilter) : undefined,
    maxBathrooms: bathroomFilter ? parseFloat(bathroomFilter) : undefined,
    hasSpecial: showSpecialsOnly || undefined,
    minSqft: sqftRange[0] > 0 ? sqftRange[0] : undefined,
    maxSqft: sqftRange[1] < 3000 ? sqftRange[1] : undefined,
    amenityIds: selectedAmenityIds.length > 0 ? selectedAmenityIds : undefined,
  });

  // C: URL-based filter persistence (shareable filtered views)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Hydrate from URL on mount
    const urlNeighborhood = params.get('neighborhood') || '';
    const urlBedrooms = params.get('bedrooms') || '';
    const urlBathrooms = params.get('bathrooms') || '';
    const urlSpecials = params.get('specials') === '1';
    const urlMinRent = params.get('minRent');
    const urlMaxRent = params.get('maxRent');
    const urlMinSqft = params.get('minSqft');
    const urlMaxSqft = params.get('maxSqft');
    const urlAmenities = params.get('amenities');

    if (urlNeighborhood) setSelectedNeighborhood(urlNeighborhood);
    if (urlBedrooms) setBedroomFilter(urlBedrooms);
    if (urlBathrooms) setBathroomFilter(urlBathrooms);
    if (urlSpecials) setShowSpecialsOnly(true);
    if (urlMinRent || urlMaxRent) {
      setRentRange([
        urlMinRent ? parseInt(urlMinRent) : 0,
        urlMaxRent ? parseInt(urlMaxRent) : 15000
      ]);
    }
    if (urlMinSqft || urlMaxSqft) {
      setSqftRange([
        urlMinSqft ? parseInt(urlMinSqft) : 0,
        urlMaxSqft ? parseInt(urlMaxSqft) : 3000
      ]);
    }
    if (urlAmenities) {
      setSelectedAmenityIds(urlAmenities.split(',').map(Number).filter(Boolean));
    }
  }, []);

  // Sync filters to URL whenever they change
  useEffect(() => {
    const params = new URLSearchParams();

    if (selectedNeighborhood) params.set('neighborhood', selectedNeighborhood);
    if (bedroomFilter) params.set('bedrooms', bedroomFilter);
    if (bathroomFilter) params.set('bathrooms', bathroomFilter);
    if (showSpecialsOnly) params.set('specials', '1');
    if (rentRange[0] > 0) params.set('minRent', rentRange[0].toString());
    if (rentRange[1] < 15000) params.set('maxRent', rentRange[1].toString());
    if (sqftRange[0] > 0) params.set('minSqft', sqftRange[0].toString());
    if (sqftRange[1] < 3000) params.set('maxSqft', sqftRange[1].toString());
    if (selectedAmenityIds.length > 0) params.set('amenities', selectedAmenityIds.join(','));

    const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [selectedNeighborhood, bedroomFilter, bathroomFilter, showSpecialsOnly, rentRange, sqftRange, selectedAmenityIds]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
            onClick={() => setShowFilterSheet(true)}
            className="gap-2 shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilters.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {activeFilters.length}
              </Badge>
            )}
          </Button>

          {isLeadAuthenticated ? (
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {lead?.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm text-slate-700 hidden sm:block">{lead?.name}</span>
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
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
            <div className="max-w-7xl mx-auto flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-36">
                <label className="block text-xs font-medium text-slate-600 mb-1">Neighborhood</label>
                <Select value={selectedNeighborhood} onValueChange={setSelectedNeighborhood}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All areas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All areas</SelectItem>
                    {neighborhoods.map(n => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-32">
                <label className="block text-xs font-medium text-slate-600 mb-1">Bedrooms</label>
                <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    <SelectItem value="0">Studio</SelectItem>
                    <SelectItem value="1">1 Bed</SelectItem>
                    <SelectItem value="2">2 Beds</SelectItem>
                    <SelectItem value="3">3 Beds</SelectItem>
                    <SelectItem value="4">4+ Beds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* New: Bathrooms filter */}
              <div className="flex-1 min-w-32">
                <label className="block text-xs font-medium text-slate-600 mb-1">Bathrooms</label>
                <Select value={bathroomFilter} onValueChange={setBathroomFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    <SelectItem value="1">1+</SelectItem>
                    <SelectItem value="1.5">1.5+</SelectItem>
                    <SelectItem value="2">2+</SelectItem>
                    <SelectItem value="3">3+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-48">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Rent: ${rentRange[0].toLocaleString()} – ${rentRange[1].toLocaleString()}/mo
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

              {/* New: Specials / Deals Only toggle */}
              <div className="flex items-center gap-2 min-w-[140px]">
                <label className="text-xs font-medium text-slate-600">Specials only</label>
                <button
                  onClick={() => setShowSpecialsOnly(!showSpecialsOnly)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    showSpecialsOnly ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      showSpecialsOnly ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs h-8">
                Reset
              </Button>
            </div>

            {/* Filter Presets */}
            <div className="mt-2 flex flex-wrap gap-2 max-w-7xl mx-auto">
              <button onClick={() => { setShowSpecialsOnly(true); setRentRange([0, 2200]); }} className="text-xs px-3 py-1 bg-white border border-slate-300 rounded-full hover:bg-slate-100">Best deals under $2,200</button>
              <button onClick={() => { setBedroomFilter('2'); setBathroomFilter('1'); setShowSpecialsOnly(true); }} className="text-xs px-3 py-1 bg-white border border-slate-300 rounded-full hover:bg-slate-100">Pet friendly 2+ beds</button>
              <button onClick={() => setSqftRange([1200, 3000])} className="text-xs px-3 py-1 bg-white border border-slate-300 rounded-full hover:bg-slate-100">Spacious (1200+ sqft)</button>
              <button onClick={() => { /* builtYear filter placeholder */ }} className="text-xs px-3 py-1 bg-white border border-slate-300 rounded-full hover:bg-slate-100">Newer buildings (2015+)</button>
            </div>

            {/* New: Square Footage slider */}
            <div className="mt-3 max-w-7xl mx-auto">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Size: {sqftRange[0]} – {sqftRange[1]} sqft
              </label>
              <Slider
                min={0}
                max={3000}
                step={50}
                value={sqftRange}
                onValueChange={v => setSqftRange(v as [number, number])}
                className="w-full"
              />
            </div>
          </div>
        )}
      </header>

      {/* Strong Matches Banner (ported from innovations) */}
      {qualification && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-blue-900">Strong matches for you</span>
            <span className="text-blue-700">
              {qualification.preferredAreas.slice(0, 2).join(" • ")}
              {qualification.moveTimeline && ` • ${qualification.moveTimeline}`}
              {qualification.bedrooms && ` • ${qualification.bedrooms}`}
              {qualification.budget && ` • ${qualification.budget}`}
            </span>
            <div className="ml-auto flex items-center gap-3 text-xs">
              <button onClick={() => setShowQualificationPrompt(true)} className="text-blue-600 hover:text-blue-800 underline">Edit my answers</button>
              <button onClick={() => { setQualification(null); setHasShownQualPrompt(false); resetFilters(); }} className="text-blue-600 hover:text-blue-800 underline">Clear</button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          TX APT FINDER POST-SUBMISSION EXPERIENCE
          Per Obsidian vault spec (May 2025-05-29)
          Shows immediately after successful LeadCaptureForm submit
      ============================================ */}
      {showPersonalizedResults && lead && (
        <div className="mx-4 mb-4 mt-2 p-4 bg-blue-50 border border-blue-200 rounded-xl max-w-7xl mx-auto">
          <p className="font-semibold text-blue-900">Welcome, {lead.name.split(" ")[0]}! Your info is saved.</p>
          <p className="text-sm text-blue-700 mt-1 mb-3">
            Here are some of the strongest current options based on what you shared. I can also send you a shortlist with today’s best deals.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button 
              size="sm"
              onClick={() => {
                // Record the shortlist request as an interaction
                if (lead) {
                  // In real use this could trigger a backend "request shortlist" mutation
                  recordInteractionMutation.mutate({ leadId: lead.id, apartmentId: 0, interactionType: 'inquiry' });
                }
                toast.success("Shortlist request received!", {
                  description: "I'll email you a curated list within a few hours.",
                });
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Send me a shortlist with current deals
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowPersonalizedResults(false)}
            >
              Continue browsing the map
            </Button>
          </div>
          <p className="text-[10px] text-blue-600 mt-2">This starts your personalized matching process with Eric.</p>
        </div>
      )}

      {/* Main layout: map left, listings right */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
        {/* Map panel */}
        <div className="lg:flex-1 h-64 lg:h-full relative">
          <MapView
            initialCenter={{ lat: 29.7604, lng: -95.3698 }}
            initialZoom={10}
            onMapReady={handleMapReady}
          />

          {/* Lead wall banner on map */}
          {!isLeadAuthenticated && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <div className="bg-white rounded-xl shadow-lg px-5 py-3 flex items-center gap-3 border border-blue-100">
                <Lock className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Unlock full listing details</p>
                  <p className="text-xs text-slate-500">Submit your info to view addresses & contact info</p>
                </div>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white ml-2 shrink-0"
                  onClick={() => setShowLeadForm(true)}
                >
                  Get Access
                </Button>
              </div>
            </div>
          )}
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
            {isLeadAuthenticated && (
              <Badge className="bg-green-100 text-green-700 text-xs">
                Full access
              </Badge>
            )}
          </div>

          {/* Active Filter Chips */}
          {activeFilters.length > 0 && (
            <div className="px-4 py-2 flex flex-wrap gap-2 border-b border-slate-100 bg-white">
              {activeFilters.map((chip, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 text-xs bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full"
                >
                  {chip.label}
                  <button
                    onClick={chip.onRemove}
                    className="ml-1 text-blue-600 hover:text-blue-800 font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={resetFilters}
                className="text-xs text-slate-500 hover:text-slate-700 underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}

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
              <div className="text-center py-16 px-4">
                <MapPin className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 text-sm font-medium mb-2">No listings match your current filters</p>
                <p className="text-xs text-slate-400 mb-4">Try widening your price range, removing some filters, or checking a different area.</p>
                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-blue-600">
                  Clear all filters
                </Button>
              </div>
            ) : (
              filtered.map(apt => (
                <ApartmentCard
                  key={apt.id}
                  apt={apt}
                  isLead={isLeadAuthenticated}
                  onLearnMore={() => handleLearnMore(apt)}
                  onViewDetails={() => handleViewDetails(apt)}
                  isSelected={selectedApartment?.id === apt.id}
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
                <DialogTitle className="text-base">{selectedApartment.name}</DialogTitle>
                <DialogDescription className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />{selectedApartment.neighborhood} area
                </DialogDescription>
              </DialogHeader>

              {/* Teased photo — blurred for visitors */}
              <div className="relative h-40 rounded-lg overflow-hidden bg-slate-100 mb-3">
                {selectedApartment.photos?.[0] ? (
                  <img
                    src={selectedApartment.photos[0]}
                    alt={selectedApartment.name}
                    className={`w-full h-full object-cover transition-all duration-300 ${
                      !isLeadAuthenticated ? 'blur-sm scale-105' : ''
                    }`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Home className="w-12 h-12 text-slate-300" />
                  </div>
                )}
                {!isLeadAuthenticated && (
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
                  !isLeadAuthenticated ? 'line-clamp-2' : 'line-clamp-3'
                }`}>
                  {selectedApartment.description}
                </p>
              )}

              {/* CTA */}
              {isLeadAuthenticated ? (
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setShowPinPreview(false);
                    setShowDetails(true);
                    if (lead) {
                      recordInteractionMutation.mutate({ leadId: lead.id, apartmentId: selectedApartment.id, interactionType: 'view' });
                    }
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
                    <Lock className="w-4 h-4 mr-2" /> Unlock Full Details
                  </Button>
                  <p className="text-xs text-slate-400 text-center">Free — just your name, email &amp; phone</p>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Lead Capture Dialog ── */}
      <Dialog open={showLeadForm} onOpenChange={setShowLeadForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-600" />
              Unlock Full Apartment Details
            </DialogTitle>
            <DialogDescription>
              {pendingApartment
                ? `Submit your contact information to view full details for ${pendingApartment.name} and all other listings.`
                : 'Submit your contact information to unlock available API listing details and the ability to inquire about any listing.'}
            </DialogDescription>
          </DialogHeader>

          {pendingApartment && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <Home className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">{pendingApartment.name}</p>
                <p className="text-xs text-slate-500">{pendingApartment.neighborhood} · {formatRent(pendingApartment.rentMin, pendingApartment.rentMax)}</p>
              </div>
            </div>
          )}

          <LeadCaptureForm onSuccess={handleLeadSuccess} />
        </DialogContent>
      </Dialog>

      {/* ── Apartment Details Dialog (Lead-only) ── */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedApartment && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedApartment.name}</DialogTitle>
                <DialogDescription className="flex items-center gap-1 text-slate-500">
                  <MapPin className="w-3.5 h-3.5" />
                  {selectedApartment.neighborhood} area
                </DialogDescription>
              </DialogHeader>

              {/* Photos */}
              <PhotoCarousel
                photos={selectedApartment.photos ?? []}
                name={selectedApartment.name}
              />

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 my-4">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <BedDouble className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-sm font-bold text-slate-900">{formatBedrooms(selectedApartment.bedrooms)}</p>
                  <p className="text-xs text-slate-500">Floor plans</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <Bath className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-sm font-bold text-slate-900">{selectedApartment.bathrooms}</p>
                  <p className="text-xs text-slate-500">Bathrooms</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <DollarSign className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-sm font-bold text-slate-900">
                    {formatRent(selectedApartment.rentMin, selectedApartment.rentMax).split('/')[0]}
                  </p>
                  <p className="text-xs text-slate-500">Per month</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {selectedApartment.availability && (
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Availability</p>
                    <p className="text-sm text-slate-800">{selectedApartment.availability}</p>
                  </div>
                )}
                {formatSqft(selectedApartment) && (
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Size range</p>
                    <p className="text-sm text-slate-800">{formatSqft(selectedApartment)}</p>
                  </div>
                )}
                {selectedApartment.builtYear && (
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Built</p>
                    <p className="text-sm text-slate-800">{selectedApartment.builtYear}</p>
                  </div>
                )}
                {selectedApartment.managedBy && (
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Managed by</p>
                    <p className="text-sm text-slate-800">{selectedApartment.managedBy}</p>
                  </div>
                )}
              </div>

              {selectedApartment.special && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Current special</p>
                  <p className="text-sm font-medium text-amber-950">{selectedApartment.special}</p>
                </div>
              )}

              {/* Description */}
              {selectedApartment.description && (
                <div className="mb-4">
                  <h4 className="font-semibold text-slate-900 text-sm mb-2">About this apartment</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">{selectedApartment.description}</p>
                </div>
              )}

              {/* Hidden info notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">
                      Exact address & landlord contact available upon request
                    </p>
                    <p className="text-xs text-amber-700">
                      The full street address, landlord name, phone, and unit availability are provided directly by the owner after you make an inquiry.
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleContactOwner}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Request Full Details from Owner
              </Button>

              <p className="text-xs text-slate-400 text-center mt-2">
                The owner will reach out to {lead?.name} at {lead?.email}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New: Filter Sheet (mobile-friendly bottom sheet style) */}
      <Dialog open={showFilterSheet} onOpenChange={setShowFilterSheet}>
        <DialogContent className="max-w-lg p-0 gap-0 rounded-t-2xl sm:rounded-2xl bottom-0 sm:bottom-auto fixed sm:relative w-full sm:w-auto">
          <DialogHeader className="px-4 pt-4 pb-2 border-b">
            <DialogTitle className="text-lg">Filters</DialogTitle>
          </DialogHeader>

          <div className="p-4 space-y-4 max-h-[70vh] overflow-auto">
            {/* Neighborhood */}
            <div>
              <label className="block text-sm font-medium mb-1">Neighborhood</label>
              <Select value={selectedNeighborhood} onValueChange={setSelectedNeighborhood}>
                <SelectTrigger>
                  <SelectValue placeholder="All areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All areas</SelectItem>
                  {neighborhoods.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Bedrooms + Bathrooms side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Bedrooms</label>
                <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    <SelectItem value="0">Studio</SelectItem>
                    <SelectItem value="1">1 Bed</SelectItem>
                    <SelectItem value="2">2 Beds</SelectItem>
                    <SelectItem value="3">3 Beds</SelectItem>
                    <SelectItem value="4">4+ Beds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Bathrooms</label>
                <Select value={bathroomFilter} onValueChange={setBathroomFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    <SelectItem value="1">1+</SelectItem>
                    <SelectItem value="1.5">1.5+</SelectItem>
                    <SelectItem value="2">2+</SelectItem>
                    <SelectItem value="3">3+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Rent */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Rent: ${rentRange[0].toLocaleString()} – ${rentRange[1].toLocaleString()}/mo
              </label>
              <Slider
                min={0}
                max={15000}
                step={100}
                value={rentRange}
                onValueChange={v => setRentRange(v as [number, number])}
              />
            </div>

            {/* Sqft */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Size: {sqftRange[0]} – {sqftRange[1]} sqft
              </label>
              <Slider
                min={0}
                max={3000}
                step={50}
                value={sqftRange}
                onValueChange={v => setSqftRange(v as [number, number])}
              />
            </div>

            {/* Specials Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Specials / Deals only</label>
              <button
                onClick={() => setShowSpecialsOnly(!showSpecialsOnly)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showSpecialsOnly ? 'bg-amber-500' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showSpecialsOnly ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Amenities Multi-select (B) */}
            {allAmenities.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">Amenities</label>
                <div className="flex flex-wrap gap-2">
                  {allAmenities.map(amenity => {
                    const isSelected = selectedAmenityIds.includes(amenity.id);
                    return (
                      <button
                        key={amenity.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedAmenityIds(selectedAmenityIds.filter(id => id !== amenity.id));
                          } else {
                            setSelectedAmenityIds([...selectedAmenityIds, amenity.id]);
                          }
                        }}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          isSelected 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-white border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {amenity.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Presets */}
            <div>
              <label className="block text-sm font-medium mb-2">Quick presets</label>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowSpecialsOnly(true); setRentRange([0, 2200]); setShowFilterSheet(false); }}>Best deals under $2,200</Button>
                <Button variant="outline" size="sm" onClick={() => { setBedroomFilter('2'); setBathroomFilter('1'); setShowSpecialsOnly(true); setShowFilterSheet(false); }}>Pet friendly 2+ beds</Button>
                <Button variant="outline" size="sm" onClick={() => { setSqftRange([1200, 3000]); setShowFilterSheet(false); }}>Spacious (1200+ sqft)</Button>
              </div>
            </div>

            {/* Saved Searches for Leads */}
            {isLeadAuthenticated && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">My Saved Searches</label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const name = prompt("Name for this search?");
                      if (name) {
                        const filters = getCurrentFiltersForSave();
                        createSavedSearchMutation.mutate({ name, ...filters });
                      }
                    }}
                  >
                    Save current
                  </Button>
                </div>

                {savedSearches.length > 0 ? (
                  <div className="space-y-2">
                    {savedSearches.map((search: any) => (
                      <div key={search.id} className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded">
                        <button
                          onClick={() => {
                            // Load the saved search
                            if (search.neighborhood) setSelectedNeighborhood(search.neighborhood);
                            if (search.minBedrooms) setBedroomFilter(search.minBedrooms.toString());
                            if (search.minBathrooms) setBathroomFilter(search.minBathrooms.toString());
                            if (search.hasSpecial) setShowSpecialsOnly(true);
                            if (search.minRent || search.maxRent) {
                              setRentRange([
                                search.minRent ?? 0,
                                search.maxRent ?? 15000
                              ]);
                            }
                            if (search.minSqft || search.maxSqft) {
                              setSqftRange([
                                search.minSqft ?? 0,
                                search.maxSqft ?? 3000
                              ]);
                            }
                            if (search.amenityIds?.length) setSelectedAmenityIds(search.amenityIds);
                            setShowFilterSheet(false);
                          }}
                          className="flex-1 text-left hover:text-blue-600"
                        >
                          {search.name}
                        </button>
                        <button
                          onClick={() => deleteSavedSearchMutation.mutate({ id: search.id })}
                          className="text-red-500 hover:text-red-700 px-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No saved searches yet. Use "Save current" above.</p>
                )}
              </div>
            )}
          </div>

          <div className="p-4 border-t flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { resetFilters(); setShowFilterSheet(false); }}>Clear all</Button>
            <Button className="flex-1" onClick={() => setShowFilterSheet(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Qualification Prompt (ported) */}
      <QualificationPrompt
        open={showQualificationPrompt}
        onOpenChange={setShowQualificationPrompt}
        onQualify={applyQualification}
        initialData={qualification ?? undefined}
        onSkip={() => setHasShownQualPrompt(true)}
      />

      {/* Mobile listings sheet (ported) */}
      {showMobileListings && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          <div className="flex-1 bg-black/40" onClick={() => setShowMobileListings(false)} />
          <div className="bg-white rounded-t-2xl shadow-2xl max-h-[70vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <div className="font-semibold">{filtered.length} listings</div>
                {qualification && <div className="text-xs text-blue-600">Filtered to your preferences</div>}
              </div>
              <button onClick={() => setShowMobileListings(false)} className="text-xl px-2">×</button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {filtered.slice(0, 15).map(apt => (
                <div key={apt.id} className="border rounded-xl p-3 text-sm" onClick={() => {
                  setSelectedApartment(apt);
                  setShowMobileListings(false);
                  if (!qualification && !hasShownQualPrompt) {
                    setHasShownQualPrompt(true);
                    setShowQualificationPrompt(true);
                  } else {
                    setShowPinPreview(true);
                  }
                }}>
                  {getDisplayName ? getDisplayName(apt.name) : apt.name} • {formatRent(apt.rentMin, apt.rentMax)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

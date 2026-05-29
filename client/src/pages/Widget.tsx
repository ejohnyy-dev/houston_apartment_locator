/**
 * Widget.tsx — Embeddable apartment search widget
 *
 * This page is designed to be loaded inside an <iframe> on any external website.
 * It renders a compact version of the apartment search with lead capture.
 *
 * Embed code:
 *   <iframe src="https://your-domain.com/widget" width="100%" height="700" frameborder="0" allowfullscreen></iframe>
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MapPin, Home, Lock, ArrowRight, BedDouble, Bath, DollarSign,
  MessageCircle, X, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import { MapView } from '@/components/Map';
import LeadCaptureForm from '@/components/LeadCaptureForm';
import { useLead } from '@/contexts/LeadContext';
import { toast } from 'sonner';

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
}

function formatRent(min: string | number, max: string | number | null): string {
  const minNum = typeof min === 'string' ? parseFloat(min) : min;
  const maxNum = max ? (typeof max === 'string' ? parseFloat(max) : max) : null;
  if (!Number.isFinite(minNum) || minNum <= 0) return 'Pricing by request';
  if (maxNum && maxNum !== minNum) {
    return `$${minNum.toLocaleString()}–$${maxNum.toLocaleString()}/mo`;
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

function getCoords(apt: ApartmentTeased): { lat: number; lng: number } {
  const lat = typeof apt.latitude === 'string' ? parseFloat(apt.latitude) : apt.latitude;
  const lng = typeof apt.longitude === 'string' ? parseFloat(apt.longitude) : apt.longitude;
  if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) return { lat, lng };
  return { lat: 29.7604, lng: -95.3698 };
}

function PhotoCarousel({ photos, name }: { photos: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  if (!photos.length) return (
    <div className="h-40 bg-slate-100 rounded-lg flex items-center justify-center">
      <Home className="w-10 h-10 text-slate-300" />
    </div>
  );
  return (
    <div className="relative h-40 rounded-lg overflow-hidden bg-slate-100">
      <img src={photos[idx]} alt={`${name} ${idx + 1}`} className="w-full h-full object-cover" />
      {photos.length > 1 && (
        <>
          <button onClick={() => setIdx(i => (i - 1 + photos.length) % photos.length)} className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1">
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button onClick={() => setIdx(i => (i + 1) % photos.length)} className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1">
            <ChevronRight className="w-3 h-3" />
          </button>
        </>
      )}
    </div>
  );
}

export default function Widget() {
  const { lead, setLead, isLeadAuthenticated } = useLead();
  const [selectedApartment, setSelectedApartment] = useState<ApartmentTeased | null>(null);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showPersonalizedResults, setShowPersonalizedResults] = useState(false); // txaptfinder.com post-submission (vault)
  const [showDetails, setShowDetails] = useState(false);
  const [pendingApartment, setPendingApartment] = useState<ApartmentTeased | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [searchText, setSearchText] = useState('');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('');
  const [bedroomFilter, setBedroomFilter] = useState('');
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const recordInteractionMutation = trpc.leads.recordInteraction.useMutation();

  const { data: apartmentsData, isLoading } = trpc.apartments.list.useQuery(
    {
      neighborhood: neighborhoodFilter || undefined,
      minBedrooms: bedroomFilter ? parseInt(bedroomFilter) : undefined,
      maxBedrooms: bedroomFilter ? parseInt(bedroomFilter) : undefined,
    },
    { staleTime: 30_000 }
  );

  const apartments: ApartmentTeased[] = (apartmentsData ?? []) as ApartmentTeased[];
  const filtered = apartments.filter(apt => {
    if (!searchText) return true;
    const term = searchText.toLowerCase();
    return [apt.name, apt.neighborhood, apt.special, apt.availability, apt.description, apt.managedBy]
      .filter((value): value is string => Boolean(value))
      .some(value => value.toLowerCase().includes(term));
  });
  const neighborhoods = Array.from(new Set(apartments.map(a => a.neighborhood))).sort();

  const placeMarkers = useCallback((map: google.maps.Map, apts: ApartmentTeased[]) => {
    markersRef.current.forEach(m => { m.map = null; });
    markersRef.current = [];
    apts.forEach(apt => {
      const { lat, lng } = getCoords(apt);
      const pin = document.createElement('div');
      const rentMin = typeof apt.rentMin === 'string' ? parseFloat(apt.rentMin) : apt.rentMin;
      pin.style.cssText = `background:#2563eb;color:white;border:2px solid white;border-radius:16px;padding:3px 8px;font-size:11px;font-weight:700;font-family:system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;white-space:nowrap;`;
      pin.textContent = Number.isFinite(rentMin) && rentMin > 0
        ? `$${rentMin >= 1000 ? (rentMin / 1000).toFixed(1) + 'k' : rentMin}`
        : 'Info';
      const marker = new google.maps.marker.AdvancedMarkerElement({ position: { lat, lng }, map, content: pin, title: apt.name });
      marker.addListener('click', () => {
        setSelectedApartment(apt);
        if (isLeadAuthenticated) { setShowDetails(true); }
        else { setPendingApartment(apt); setShowLeadForm(true); }
      });
      markersRef.current.push(marker);
    });
  }, [isLeadAuthenticated]);

  useEffect(() => {
    if (mapRef.current && filtered.length > 0) placeMarkers(mapRef.current, filtered);
  }, [filtered, placeMarkers]);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (filtered.length > 0) placeMarkers(map, filtered);
  }, [filtered, placeMarkers]);

  const handleLeadSuccess = (newLead: { 
    id: number; 
    name: string; 
    email: string; 
    phone: string;
    moveTimeline?: string;
  }) => {
    setLead(newLead);
    setShowLeadForm(false);

    const firstName = newLead.name.split(' ')[0];
    toast.success(`Thanks, ${firstName}! Full access unlocked.`, {
      description: "Preferences noted. Strong matches highlighted.",
    });

    // Trigger personalized post-submission experience (vault spec for txaptfinder.com)
    setShowPersonalizedResults(true);

    if (pendingApartment) {
      setSelectedApartment(pendingApartment);
      setShowDetails(true);
      setPendingApartment(null);
    }
  };

  const handleContactOwner = () => {
    if (selectedApartment && lead) {
      recordInteractionMutation.mutate({ leadId: lead.id, apartmentId: selectedApartment.id, interactionType: 'inquiry' });
    }
    toast.success('Inquiry sent! The owner will contact you shortly.');
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden font-sans">
      {/* Widget Header */}
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Home className="w-5 h-5" />
          <span className="font-bold text-sm">TX Apt Finder</span>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-blue-700 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-white text-blue-600' : 'text-blue-100 hover:text-white'}`}
            >
              List
            </button>
            <button
              onClick={() => setView('map')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === 'map' ? 'bg-white text-blue-600' : 'text-blue-100 hover:text-white'}`}
            >
              Map
            </button>
          </div>
          {isLeadAuthenticated && (
            <div className="flex items-center gap-1.5 bg-blue-700 rounded-full px-2 py-1">
              <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-blue-600 text-xs font-bold">
                {lead?.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-xs text-blue-100">{lead?.name?.split(' ')[0]}</span>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Search name, city, special..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-slate-400" />
            </button>
          )}
        </div>
        <Select value={neighborhoodFilter} onValueChange={setNeighborhoodFilter}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All areas</SelectItem>
            {neighborhoods.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
          <SelectTrigger className="w-24 h-8 text-xs">
            <SelectValue placeholder="Beds" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any</SelectItem>
            <SelectItem value="0">Studio</SelectItem>
            <SelectItem value="1">1 Bed</SelectItem>
            <SelectItem value="2">2 Beds</SelectItem>
            <SelectItem value="3">3+ Beds</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lead wall banner */}
      {!isLeadAuthenticated && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center gap-2 shrink-0">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800 flex-1">Submit your info to unlock full listing details</p>
          <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 shrink-0" onClick={() => setShowLeadForm(true)}>
            Unlock
          </Button>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {view === 'list' ? (
          <div className="h-full overflow-y-auto p-3 space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-3 flex gap-3">
                  <Skeleton className="w-24 h-20 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </Card>
              ))
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No listings found</p>
              </div>
            ) : (
              filtered.map(apt => {
                return (
                  <Card
                    key={apt.id}
                    className={`overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${selectedApartment?.id === apt.id ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => {
                      setSelectedApartment(apt);
                      if (isLeadAuthenticated) setShowDetails(true);
                      else { setPendingApartment(apt); setShowLeadForm(true); }
                    }}
                  >
                    <div className="flex gap-0">
                      {/* Photo */}
                      <div className="relative w-28 h-24 bg-slate-100 shrink-0">
                        {apt.photos?.[0] ? (
                          <img src={apt.photos[0]} alt={apt.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Home className="w-8 h-8 text-slate-300" />
                          </div>
                        )}
                        {!isLeadAuthenticated && (
                          <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center">
                            <Lock className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 p-3">
                        <h3 className="font-semibold text-slate-900 text-xs mb-0.5 truncate">{apt.name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-0.5 mb-1">
                          <MapPin className="w-2.5 h-2.5" />{apt.neighborhood}
                        </p>
                        <p className="text-sm font-bold text-blue-600 mb-2">
                          {formatRent(apt.rentMin, apt.rentMax)}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="flex items-center gap-0.5"><BedDouble className="w-3 h-3" />{formatBedrooms(apt.bedrooms)}</span>
                          <span className="flex items-center gap-0.5"><Bath className="w-3 h-3" />{apt.bathrooms} Bath</span>
                        </div>
                        {apt.special && (
                          <p className="text-xs text-amber-700 mt-1 line-clamp-1">Special: {apt.special}</p>
                        )}
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center pr-3">
                        <ArrowRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        ) : (
          <div className="h-full relative">
            <MapView
              initialCenter={{ lat: 29.7604, lng: -95.3698 }}
              initialZoom={10}
              onMapReady={handleMapReady}
            />
            {!isLeadAuthenticated && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
                <button
                  onClick={() => setShowLeadForm(true)}
                  className="bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2 border border-blue-100 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Lock className="w-4 h-4" /> Unlock full details
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result count footer */}
      <div className="border-t border-slate-100 px-3 py-2 bg-white flex items-center justify-between shrink-0">
        <p className="text-xs text-slate-500">
          {isLoading ? 'Loading…' : `${filtered.length} listing${filtered.length !== 1 ? 's' : ''}`}
        </p>
        {isLeadAuthenticated && (
          <Badge className="bg-green-100 text-green-700 text-xs">Full access</Badge>
        )}
      </div>

      {/* Lead Capture Dialog */}
      <Dialog open={showLeadForm} onOpenChange={setShowLeadForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Lock className="w-4 h-4 text-blue-600" /> Unlock Apartment Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enter your contact info to view full details and inquire about listings.
            </DialogDescription>
          </DialogHeader>
          {pendingApartment && (
            <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-2 mb-1">
              <Home className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-900">{pendingApartment.name}</p>
                <p className="text-xs text-slate-500">{pendingApartment.neighborhood} · {formatRent(pendingApartment.rentMin, pendingApartment.rentMax)}</p>
              </div>
            </div>
          )}
          <LeadCaptureForm onSuccess={handleLeadSuccess} />
        </DialogContent>
      </Dialog>

      {/* Apartment Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          {selectedApartment && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{selectedApartment.name}</DialogTitle>
                <DialogDescription className="flex items-center gap-1 text-xs">
                  <MapPin className="w-3 h-3" />{selectedApartment.neighborhood} area
                </DialogDescription>
              </DialogHeader>

              <PhotoCarousel photos={selectedApartment.photos ?? []} name={selectedApartment.name} />

              <div className="grid grid-cols-3 gap-2 my-3">
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <BedDouble className="w-4 h-4 text-blue-600 mx-auto mb-0.5" />
                  <p className="text-sm font-bold">{formatBedrooms(selectedApartment.bedrooms)}</p>
                  <p className="text-xs text-slate-500">Plans</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <Bath className="w-4 h-4 text-blue-600 mx-auto mb-0.5" />
                  <p className="text-sm font-bold">{selectedApartment.bathrooms}</p>
                  <p className="text-xs text-slate-500">Baths</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <DollarSign className="w-4 h-4 text-blue-600 mx-auto mb-0.5" />
                  <p className="text-sm font-bold">{formatRent(selectedApartment.rentMin, selectedApartment.rentMax).split('/')[0]}</p>
                  <p className="text-xs text-slate-500">Rent</p>
                </div>
              </div>

              {(selectedApartment.availability || formatSqft(selectedApartment) || selectedApartment.special) && (
                <div className="space-y-2 mb-3">
                  {selectedApartment.special && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <p className="text-xs font-semibold text-amber-800">Special</p>
                      <p className="text-xs text-amber-950">{selectedApartment.special}</p>
                    </div>
                  )}
                  {selectedApartment.availability && (
                    <p className="text-xs text-slate-600"><span className="font-semibold text-slate-800">Availability:</span> {selectedApartment.availability}</p>
                  )}
                  {formatSqft(selectedApartment) && (
                    <p className="text-xs text-slate-600"><span className="font-semibold text-slate-800">Size:</span> {formatSqft(selectedApartment)}</p>
                  )}
                </div>
              )}

              {selectedApartment.description && (
                <p className="text-xs text-slate-600 leading-relaxed mb-3">{selectedApartment.description}</p>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    Exact address and landlord contact are shared directly by the owner after your inquiry.
                  </p>
                </div>
              </div>

              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm" onClick={handleContactOwner}>
                <MessageCircle className="w-4 h-4 mr-2" /> Request Full Details
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useRef, useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn, getDisplayName } from "@/lib/utils";
import { loadMarkerClustererLibrary, createMarkerClusterer } from "@/lib/markerClusterer";
import { useQualification } from "@/contexts/QualificationContext";

declare global {
  interface Window {
    google: any;
    initMap?: () => void;
    handleApartmentInquiry?: (apartmentId: string, apartmentName: string) => void;
  }
}



const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL = import.meta.env.VITE_FRONTEND_FORGE_API_URL || "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

let mapScriptLoadPromise: Promise<void> | null = null;

function loadMapScript() {
  // Return existing promise if already loading
  if (mapScriptLoadPromise) {
    return mapScriptLoadPromise;
  }

  mapScriptLoadPromise = new Promise<void>((resolve) => {
    if (window.google?.maps) {
      mapScriptLoadPromise = null;
      resolve();
      return;
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector(
      'script[src*="/maps/api/js"]'
    );
    if (existingScript) {
      mapScriptLoadPromise = null;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,places,geocoding,routes,drawing,visualization,geometry`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      mapScriptLoadPromise = null;
      resolve();
    };
    script.onerror = () => {
      console.error("Failed to load Google Maps script");
      mapScriptLoadPromise = null;
      resolve();
    };
    document.head.appendChild(script);
  });

  return mapScriptLoadPromise;
}

interface HomeMapViewProps {
  className?: string;
  filters?: {
    searchText: string;
    minBedrooms: number | null;
    maxBedrooms: number | null;
    minRent: number | null;
    maxRent: number | null;
  };
  neighborhoods?: string[];
}

export function HomeMapView({ className, filters }: HomeMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filteredCount, setFilteredCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const { hasQualified, isCheckingServer, setShowQualificationPrompt } = useQualification();
  // Ref mirror so map event listeners see fresh state without re-initialising the map
  const hasAccessRef = useRef(hasQualified);
  useEffect(() => {
    hasAccessRef.current = hasQualified;
  }, [hasQualified]);

  // Immediately prompt with the questionnaire as soon as the visitor reaches the map
  useEffect(() => {
    if (isCheckingServer || hasQualified) return;
    const el = mapContainer.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setShowQualificationPrompt(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isCheckingServer, hasQualified, setShowQualificationPrompt]);
  const { data: apartments } = trpc.apartments.list.useQuery({
    minRent: 0,
    maxRent: 10000,
  });

  // Set up global inquiry handler
  useEffect(() => {
    window.handleApartmentInquiry = (apartmentId: string, apartmentName: string) => {
      // Emit custom event for parent component to handle
      const event = new CustomEvent("apartmentInquiry", {
        detail: { apartmentId, apartmentName },
      });
      window.dispatchEvent(event);
      console.log(`Inquiry for apartment: ${apartmentName} (ID: ${apartmentId})`);
    };
  }, []);

  const initMap = useCallback(async () => {
    try {
      setIsLoading(true);
      setHasError(false);
      await loadMapScript();
      await loadMarkerClustererLibrary();
      
      if (!mapContainer.current) {
        console.error("Map container not found");
        setHasError(true);
        return;
      }

      if (!window.google?.maps) {
        console.error("Google Maps API not loaded");
        setHasError(true);
        return;
      }

      // Houston center coordinates
      const houstonCenter = { lat: 29.7604, lng: -95.3698 };

      map.current = new window.google.maps.Map(mapContainer.current, {
        zoom: 11,
        center: houstonCenter,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: true,
        mapId: "DEMO_MAP_ID",
      });

      // Add apartment markers with clustering
      if (apartments && apartments.length > 0) {
        // Apply filters
        const filteredApartments = apartments.filter((apt) => {
          // Filter by search text (name or neighborhood)
          if (filters?.searchText) {
            const searchLower = filters.searchText.toLowerCase();
            const nameMatch = apt.name.toLowerCase().includes(searchLower);
            const neighborhoodMatch = (apt.neighborhood || "").toLowerCase().includes(searchLower);
            if (!nameMatch && !neighborhoodMatch) return false;
          }

          // Filter by bedrooms
          if (filters && filters.minBedrooms !== null && apt.bedrooms < filters.minBedrooms) return false;
          if (filters && filters.maxBedrooms !== null && apt.bedrooms > filters.maxBedrooms) return false;

          // Filter by rent
          if (filters && filters.minRent !== null && apt.rentMin < filters.minRent) return false;
          if (filters && filters.maxRent !== null && apt.rentMin > filters.maxRent) return false;

          return true;
        });

        setFilteredCount(filteredApartments.length);
        console.log(`Adding ${filteredApartments.length} filtered markers to map with clustering`);
        const markers: google.maps.Marker[] = [];
        const infoWindows: Map<google.maps.Marker, google.maps.InfoWindow> = new Map();
        
        filteredApartments.forEach((apt, index) => {
          // Use latitude/longitude from apartment data
          let lat = (apt as any).latitude;
          let lng = (apt as any).longitude;
          
          if (lat && lng && lat !== 0 && lng !== 0) {
            // Add a tiny bit of jitter if markers are at the exact same location
            // This is common for neighborhood-level coordinates
            const jitter = 0.002; // Roughly 200 meters
            const latJitter = (Math.random() - 0.5) * jitter;
            const lngJitter = (Math.random() - 0.5) * jitter;
            
            // Create standard Marker
            const marker = new window.google.maps.Marker({
              position: { lat: lat + latJitter, lng: lng + lngJitter },
              title: getDisplayName(apt.name),
            });
            markers.push(marker);

            // Create info window content with lead capture
            const minRent = (apt as any).rentMin || (apt as any).minPrice;
            const maxRent = (apt as any).rentMax || (apt as any).maxPrice;
            const apartmentId = apt.id;
            
            const infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div class="p-3 max-w-xs bg-white rounded-lg shadow-sm">
                  <h3 class="font-semibold text-sm text-gray-900">${getDisplayName(apt.name)}</h3>
                  <p class="text-xs text-gray-600">${apt.neighborhood || "Houston"}</p>
                  <p class="text-sm font-medium text-yellow-600 mt-1">$${minRent?.toLocaleString() || "N/A"} - $${maxRent?.toLocaleString() || "N/A"}</p>
                  <p class="text-xs text-gray-600 mt-1">${apt.bedrooms || "?"} bed${apt.bedrooms !== 1 ? "s" : ""}</p>
                  <button class="mt-2 w-full px-3 py-2 bg-[#C9A96E] text-black font-semibold text-xs rounded hover:bg-[#B8985D] transition-colors" data-apt-id="${apartmentId}" onclick="window.handleApartmentInquiry && window.handleApartmentInquiry('${apartmentId}', '${getDisplayName(apt.name).replace(/'/g, "\\'")}')">
                    See Full Property Details
                  </button>
                </div>
              `,
            });
            infoWindows.set(marker, infoWindow);

            marker.addListener("click", () => {
              // Preferences + contact info are mandatory before browsing listings
              if (!hasAccessRef.current) {
                setShowQualificationPrompt(true);
                return;
              }
              // Close all other info windows
              infoWindows.forEach((iw) => {
                iw.close();
              });
              infoWindow.open(map.current, marker);
            });
          }
        });

        console.log(`Successfully created ${markers.length} markers`);

        // Apply clustering
        if (map.current && markers.length > 0) {
          const clusterer = createMarkerClusterer(map.current, markers);
          if (clusterer) {
            console.log("Marker clustering enabled successfully");
          } else {
            // Fallback: add markers without clustering
            console.log("Clustering unavailable, adding markers without clustering");
            markers.forEach(marker => marker.setMap(map.current));
          }
        }
      }
    } catch (error) {
      console.error("Error initializing map:", error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [apartments, filters, setShowQualificationPrompt]);

  useEffect(() => {
    initMap();
  }, [initMap]);

  return (
    <div className={cn("w-full h-full relative", className)}>
      <noscript>
        <div className="w-full h-full bg-gray-100 flex items-center justify-center p-4">
          <p className="text-center text-gray-600">Interactive map requires JavaScript. Please enable JavaScript to view the apartment map.</p>
        </div>
      </noscript>
      <div 
        ref={mapContainer} 
        className="w-full h-full" 
        title="Interactive map showing 530+ available apartments in Houston with filtering options"
        role="region"
        aria-label="Houston apartment map showing 530+ available apartments with search and filter options"
        aria-describedby="map-description"
      />
      <div id="map-description" style={{display: 'none'}}>Interactive Google Map displaying 530+ available apartments in Houston. Use the search bar to filter by neighborhood or apartment name. Use the filter icon to filter by number of bedrooms and rent price. Click on any apartment marker to view details and request full property information.</div>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 bg-opacity-50 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
            <p className="text-sm text-gray-600 mt-2">Loading map...</p>
          </div>
        </div>
      )}
      {hasError && (
        <div className="absolute inset-0 bg-red-50 bg-opacity-90 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <p className="text-sm text-red-600 font-semibold">Unable to load map</p>
            <p className="text-xs text-red-500 mt-1">Please try refreshing the page</p>
          </div>
        </div>
      )}
      {!isLoading && !hasError && filteredCount === 0 && apartments && apartments.length > 0 && (
        <div className="absolute inset-0 bg-blue-50 bg-opacity-90 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <p className="text-sm text-blue-600 font-semibold">No apartments match your filters</p>
            <p className="text-xs text-blue-500 mt-1">Try adjusting your search criteria</p>
          </div>
        </div>
      )}
    </div>
  );
}

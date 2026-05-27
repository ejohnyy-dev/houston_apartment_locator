import { useEffect, useRef, useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { loadMarkerClustererLibrary, createMarkerClusterer } from "@/lib/markerClusterer";

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

function loadMapScript() {
  return new Promise<void>((resolve) => {
    if (window.google?.maps) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,places,geocoding,routes,drawing,visualization,geometry`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      resolve();
      script.remove();
    };
    script.onerror = () => {
      console.error("Failed to load Google Maps script");
      resolve(); // Continue without maps
    };
    document.head.appendChild(script);
  });
}

interface HomeMapViewProps {
  className?: string;
}

export function HomeMapView({ className }: HomeMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
      await loadMapScript();
      await loadMarkerClustererLibrary();
      
      if (!mapContainer.current) {
        console.error("Map container not found");
        return;
      }

      if (!window.google?.maps) {
        console.error("Google Maps API not loaded");
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
        console.log(`Adding ${apartments.length} markers to map with clustering`);
        const markers: google.maps.Marker[] = [];
        const infoWindows: Map<google.maps.Marker, google.maps.InfoWindow> = new Map();
        
        apartments.forEach((apt) => {
          // Use latitude/longitude from apartment data
          const lat = (apt as any).latitude;
          const lng = (apt as any).longitude;
          
          if (lat && lng && lat !== 0 && lng !== 0) {
            // Create standard Marker
            const marker = new window.google.maps.Marker({
              position: { lat, lng },
              title: apt.name,
            });
            markers.push(marker);

            // Create info window content with lead capture
            const minRent = (apt as any).rentMin || (apt as any).minPrice;
            const maxRent = (apt as any).rentMax || (apt as any).maxPrice;
            const apartmentId = apt.id;
            
            const infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div class="p-3 max-w-xs bg-white rounded-lg shadow-sm">
                  <h3 class="font-semibold text-sm text-gray-900">${apt.name}</h3>
                  <p class="text-xs text-gray-600">${apt.neighborhood || "Houston"}</p>
                  <p class="text-sm font-medium text-yellow-600 mt-1">$${minRent?.toLocaleString() || "N/A"} - $${maxRent?.toLocaleString() || "N/A"}</p>
                  <p class="text-xs text-gray-600 mt-1">${apt.bedrooms || "?"} bed${apt.bedrooms !== 1 ? "s" : ""}</p>
                  <button class="mt-2 w-full px-3 py-1.5 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition-colors" data-apt-id="${apartmentId}" onclick="window.handleApartmentInquiry && window.handleApartmentInquiry('${apartmentId}', '${apt.name}')">
                    Inquire Now
                  </button>
                </div>
              `,
            });
            infoWindows.set(marker, infoWindow);

            marker.addListener("click", () => {
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
    } finally {
      setIsLoading(false);
    }
  }, [apartments]);

  useEffect(() => {
    initMap();
  }, [initMap]);

  return (
    <div className={cn("w-full h-full relative", className)}>
      <div ref={mapContainer} className="w-full h-full" />
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 bg-opacity-50 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
            <p className="text-sm text-gray-600 mt-2">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: any;
    initMap?: () => void;
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
  const { data: apartments } = trpc.apartments.list.useQuery({
    minPrice: 0,
    maxPrice: 10000,
  });

  const initMap = useCallback(async () => {
    await loadMapScript();
    if (!mapContainer.current) {
      console.error("Map container not found");
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

    // Add apartment markers
    if (apartments && apartments.length > 0) {
      apartments.forEach((apt) => {
        // Use latitude/longitude from apartment data
        const lat = (apt as any).latitude || 29.7604;
        const lng = (apt as any).longitude || -95.3698;
        
        if (lat && lng) {
          // Create marker
          const marker = new window.google.maps.marker.AdvancedMarkerElement({
            map: map.current,
            position: { lat, lng },
            title: apt.name,
          });

          // Add click listener to show info window
          const minRent = (apt as any).minRent || apt.minPrice;
          const maxRent = (apt as any).maxRent || apt.maxPrice;
          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div class="p-2 max-w-xs">
                <h3 class="font-semibold text-sm">${apt.name}</h3>
                <p class="text-xs text-gray-600">${apt.neighborhood || "Houston"}</p>
                <p class="text-sm font-medium text-gold mt-1">$${minRent?.toLocaleString() || "N/A"} - $${maxRent?.toLocaleString() || "N/A"}</p>
                <p class="text-xs text-gray-600 mt-1">${apt.bedrooms || "?"} bed${apt.bedrooms !== 1 ? "s" : ""}</p>
              </div>
            `,
          });

          marker.addListener("click", () => {
            infoWindow.open(map.current, marker);
          });
        }
      });
    }
  }, [apartments]);

  useEffect(() => {
    initMap();
  }, [initMap]);

  return <div ref={mapContainer} className={cn("w-full h-full", className)} />;
}

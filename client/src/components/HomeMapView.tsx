import { useEffect, useRef, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { useQualification } from "@/contexts/QualificationContext";
import type { Apartment } from "@/lib/apartments";

declare global {
  interface Window {
    google?: typeof google;
  }
}

const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL ||
  "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

let mapScriptLoadPromise: Promise<void> | null = null;

export function loadMapScript(): Promise<void> {
  if (mapScriptLoadPromise) return mapScriptLoadPromise;
  if (window.google?.maps) return Promise.resolve();

  mapScriptLoadPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector('script[src*="/maps/api/js"]');
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,places,geocoding,geometry`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => {
      console.error("Failed to load Google Maps script");
      mapScriptLoadPromise = null;
      resolve();
    };
    document.head.appendChild(script);
  });

  return mapScriptLoadPromise;
}

export const HOUSTON_CENTER = { lat: 29.7604, lng: -95.3698 };

function formatRent(min: number, max: number): string {
  if (!min || min <= 0) return "Pricing by request";
  if (max && max !== min) {
    return `$${min.toLocaleString()} – $${max.toLocaleString()}/mo`;
  }
  return `$${min.toLocaleString()}/mo`;
}

interface HomeMapViewProps {
  className?: string;
}

/**
 * Homepage apartment map. The questionnaire is mandatory: it opens as soon
 * as the visitor scrolls the map into view, and marker interaction stays
 * locked until preferences + contact info are submitted.
 */
export function HomeMapView({ className }: HomeMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [apartments, setApartments] = useState<Apartment[] | null>(null);
  const { hasQualified, setShowQualificationPrompt } = useQualification();

  // Ref mirror so map listeners see fresh state without re-initialising the map
  const hasAccessRef = useRef(hasQualified);
  useEffect(() => {
    hasAccessRef.current = hasQualified;
  }, [hasQualified]);

  // Open the questionnaire the moment the visitor reaches the map
  useEffect(() => {
    if (hasQualified) return;
    const el = mapContainer.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShowQualificationPrompt(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasQualified, setShowQualificationPrompt]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/apartments")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setApartments(data.apartments ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setHasError(true);
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const initMap = useCallback(async () => {
    if (!apartments) return;
    try {
      setIsLoading(true);
      setHasError(false);
      await loadMapScript();

      if (!mapContainer.current || !window.google?.maps) {
        setHasError(true);
        return;
      }

      map.current = new window.google.maps.Map(mapContainer.current, {
        zoom: 10,
        center: HOUSTON_CENTER,
        mapTypeControl: false,
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: false,
        mapId: "DEMO_MAP_ID",
      });

      const infoWindow = new window.google.maps.InfoWindow();

      apartments.forEach((apt) => {
        if (!apt.latitude || !apt.longitude) return;
        const marker = new window.google.maps.marker.AdvancedMarkerElement({
          map: map.current,
          position: { lat: apt.latitude, lng: apt.longitude },
          title: apt.name,
        });

        marker.addListener("click", () => {
          // Preferences + contact info are mandatory before browsing listings
          if (!hasAccessRef.current) {
            setShowQualificationPrompt(true);
            return;
          }
          infoWindow.setContent(`
            <div style="padding:8px;max-width:240px;color:#111">
              <h3 style="font-weight:600;font-size:14px;margin:0 0 4px">${apt.name}</h3>
              <p style="font-size:12px;color:#555;margin:0 0 4px">${apt.neighborhood} area</p>
              <p style="font-size:13px;font-weight:500;color:#a16207;margin:0 0 4px">${formatRent(apt.rentMin, apt.rentMax)}</p>
              <p style="font-size:12px;color:#555;margin:0">${apt.bedrooms === 0 ? "Studio" : `${apt.bedrooms} bed`} · ${apt.bathrooms} bath</p>
              <a href="/search" style="display:block;margin-top:8px;text-align:center;padding:6px;background:#C9A96E;color:#000;font-weight:600;font-size:12px;border-radius:4px;text-decoration:none">View in Search</a>
            </div>
          `);
          infoWindow.open({ map: map.current!, anchor: marker });
        });
      });
    } catch (error) {
      console.error("Error initializing map:", error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [apartments, setShowQualificationPrompt]);

  useEffect(() => {
    initMap();
  }, [initMap]);

  return (
    <div className={cn("w-full h-full relative", className)}>
      <div
        ref={mapContainer}
        className="w-full h-full rounded-lg"
        role="region"
        aria-label="Map of available Houston apartments"
      />
      {!hasQualified && !isLoading && (
        <button
          onClick={() => setShowQualificationPrompt(true)}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-lg cursor-pointer"
        >
          <span className="px-5 py-3 rounded-lg bg-[#C9A96E] text-black font-semibold text-sm shadow-lg">
            Answer a few questions to unlock the map
          </span>
        </button>
      )}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
            <p className="text-sm text-gray-200 mt-2">Loading map...</p>
          </div>
        </div>
      )}
      {hasError && (
        <div className="absolute inset-0 bg-red-50/90 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <p className="text-sm text-red-600 font-semibold">Unable to load map</p>
            <p className="text-xs text-red-500 mt-1">Please try refreshing the page</p>
          </div>
        </div>
      )}
    </div>
  );
}

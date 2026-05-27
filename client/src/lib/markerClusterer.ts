/**
 * MarkerClusterer utility for managing clustered markers on Google Maps
 * Uses the @googlemaps/markerclusterer library via CDN
 */

declare global {
  interface Window {
    markerClustererLib?: any;
  }
}

const MARKER_CLUSTERER_CDN = "https://cdn.jsdelivr.net/npm/@googlemaps/markerclusterer@2.5.0";

/**
 * Load the MarkerClusterer library from CDN
 */
export async function loadMarkerClustererLibrary(): Promise<boolean> {
  return new Promise((resolve) => {
    // Check if already loaded
    if (window.markerClustererLib) {
      resolve(true);
      return;
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector(`script[src="${MARKER_CLUSTERER_CDN}"]`);
    if (existingScript) {
      // Wait for it to load
      existingScript.addEventListener("load", () => {
        window.markerClustererLib = (window as any).markerClusterer;
        resolve(true);
      });
      existingScript.addEventListener("error", () => {
        console.warn("MarkerClusterer library failed to load, clustering disabled");
        resolve(false);
      });
      return;
    }

    const script = document.createElement("script");
    script.src = MARKER_CLUSTERER_CDN;
    script.async = true;
    script.type = "module";

    script.onload = () => {
      // The library exports as a default export in ES module
      window.markerClustererLib = (window as any).markerClusterer;
      resolve(true);
    };

    script.onerror = () => {
      console.warn("Failed to load MarkerClusterer library from CDN, clustering disabled");
      resolve(false);
    };

    document.head.appendChild(script);
  });
}

/**
 * Create a marker clusterer instance
 */
export function createMarkerClusterer(
  map: google.maps.Map,
  markers: google.maps.Marker[]
): any {
  if (!window.markerClustererLib) {
    console.warn("MarkerClusterer library not loaded");
    return null;
  }

  try {
    const MarkerClusterer = window.markerClustererLib.MarkerClusterer;
    const SuperClusterAlgorithm = window.markerClustererLib.SuperClusterAlgorithm;

    return new MarkerClusterer({
      map,
      markers,
      algorithm: new SuperClusterAlgorithm({
        maxZoom: 15,
        radius: 80,
      }),
    });
  } catch (error) {
    console.error("Failed to create MarkerClusterer instance:", error);
    return null;
  }
}

/**
 * Check if MarkerClusterer is available
 */
export function isMarkerClustererAvailable(): boolean {
  return !!window.markerClustererLib;
}

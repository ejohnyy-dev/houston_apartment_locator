// Client-side type + fetch helper for the curated listing inventory served
// by GET /api/apartments. Listings never include addresses — renters contact
// the locator to learn which property a listing is.

export interface Apartment {
  id: number;
  name: string;
  neighborhood: string;
  bedrooms: number;
  bathrooms: number;
  rentMin: number;
  rentMax: number;
  price1brMin?: number | null;
  price1brMax?: number | null;
  price2brMin?: number | null;
  price2brMax?: number | null;
  description: string;
  amenities: string[];
  latitude: number;
  longitude: number;
  special?: string | null;
  builtYear?: number | null;
  minSqft?: number | null;
  maxSqft?: number | null;
}

export interface ApartmentsResponse {
  apartments: Apartment[];
  neighborhoods: string[];
}

export async function fetchApartments(): Promise<ApartmentsResponse> {
  const res = await fetch("/api/apartments");
  if (!res.ok) throw new Error("Failed to load listings");
  return res.json();
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Strip street address from apartment name for privacy. The server already
// masks listing names in public API responses; this is defense-in-depth for
// values cached client-side before masking existed (e.g. saved favorites).
export function getDisplayName(name: string): string {
  if (!name) return "";

  // If there is a comma, the part before the comma is the complex name
  // e.g. "The Oaks, 123 Main St" → "The Oaks"
  const commaIdx = name.indexOf(',');
  if (commaIdx > 0) {
    name = name.slice(0, commaIdx);
  }

  // A name that starts with a number is a raw street address
  // (e.g. "4711 LJ Pkwy") and must never be shown to renters.
  if (/^\d/.test(name.trim())) {
    return "Private Listing";
  }

  return name.trim();
}

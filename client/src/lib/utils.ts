import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Strip street address from apartment name for privacy.
// Priority: return the complex/marketing name, never a raw street address.
export function getDisplayName(name: string): string {
  if (!name) return "";

  // If there is a comma, the part before the comma is the complex name
  // e.g. "The Oaks, 123 Main St" → "The Oaks"
  const commaIdx = name.indexOf(',');
  if (commaIdx > 0) {
    return name.slice(0, commaIdx).trim();
  }

  // If the name starts with a number it is likely a raw street address
  // e.g. "4711 LJ Pkwy" — return it as-is; the neighborhood field provides
  // the location context and we should not mangle the name into a fragment.
  // Callers that need to hide the address should use the neighborhood field.
  return name.trim();
}

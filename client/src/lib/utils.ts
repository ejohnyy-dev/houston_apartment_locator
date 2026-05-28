import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Strip street address from apartment name for privacy
export function getDisplayName(name: string) {
  if (!name) return "";
  
  // Remove street address patterns (e.g., "123 Main St, City, State 12345")
  // Keep only the building/complex name
  const parts = name.split(',');
  if (parts.length > 1) {
    // If there's a comma, likely has address, return first part
    return parts[0].trim();
  }
  // If no comma, check for patterns like "123 Street Name"
  const addressPattern = /^\d+\s+/;
  if (addressPattern.test(name)) {
    // Remove leading number and street
    const words = name.split(' ');
    // Skip first word (number) and second word (street type), return rest
    return words.slice(2).join(' ') || name;
  }
  return name;
}

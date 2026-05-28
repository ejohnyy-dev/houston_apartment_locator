import { useState, useEffect } from "react";

export interface FavoriteApartment {
  apartmentId: string;
  apartmentName: string;
  neighborhood?: string;
  rentMin?: number;
  rentMax?: number;
  bedrooms?: number;
}

const FAVORITES_STORAGE_KEY = "apartment-favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteApartment[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setFavorites(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error("Failed to load favorites from localStorage:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
      } catch (error) {
        console.error("Failed to save favorites to localStorage:", error);
      }
    }
  }, [favorites, isLoaded]);

  const addFavorite = (apartment: FavoriteApartment) => {
    setFavorites((prev) => {
      // Check if already exists
      const exists = prev.some((fav) => fav.apartmentId === apartment.apartmentId);
      if (exists) return prev;
      return [...prev, apartment];
    });
  };

  const removeFavorite = (apartmentId: string) => {
    setFavorites((prev) => prev.filter((fav) => fav.apartmentId !== apartmentId));
  };

  const isFavorited = (apartmentId: string) => {
    return favorites.some((fav) => fav.apartmentId === apartmentId);
  };

  const toggleFavorite = (apartment: FavoriteApartment) => {
    if (isFavorited(apartment.apartmentId)) {
      removeFavorite(apartment.apartmentId);
    } else {
      addFavorite(apartment);
    }
  };

  const clearFavorites = () => {
    setFavorites([]);
  };

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorited,
    toggleFavorite,
    clearFavorites,
    isLoaded,
  };
}

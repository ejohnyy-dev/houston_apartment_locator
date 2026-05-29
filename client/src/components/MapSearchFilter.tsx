import { useState, useCallback } from "react";
import { Search, Sliders, X } from "lucide-react";

interface MapSearchFilterProps {
  onFilterChange?: (filters: MapFilters) => void;
}

export interface MapFilters {
  searchText: string;
  minBedrooms: number | null;
  maxBedrooms: number | null;
  minRent: number | null;
  maxRent: number | null;
}

export function MapSearchFilter({ onFilterChange }: MapSearchFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<MapFilters>({
    searchText: "",
    minBedrooms: null,
    maxBedrooms: null,
    minRent: null,
    maxRent: null,
  });

  const handleFilterChange = useCallback(
    (newFilters: Partial<MapFilters>) => {
      const updatedFilters = { ...filters, ...newFilters };
      setFilters(updatedFilters);
      onFilterChange?.(updatedFilters);
    },
    [filters, onFilterChange]
  );

  const handleReset = useCallback(() => {
    const resetFilters: MapFilters = {
      searchText: "",
      minBedrooms: null,
      maxBedrooms: null,
      minRent: null,
      maxRent: null,
    };
    setFilters(resetFilters);
    onFilterChange?.(resetFilters);
  }, [onFilterChange]);

  const hasActiveFilters =
    Boolean(filters.searchText?.trim()) ||
    filters.minBedrooms !== null ||
    filters.maxBedrooms !== null ||
    filters.minRent !== null ||
    filters.maxRent !== null;

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-5 mb-4 border border-gray-100">
      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-yellow-600 w-5 h-5" />
          <input
            type="text"
            placeholder="Search apartments..."
            value={filters.searchText}
            onChange={(e) => handleFilterChange({ searchText: e.target.value })}
            className="w-full pl-12 pr-4 py-3 sm:py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm bg-gray-50 hover:bg-white transition-colors min-h-[44px] sm:min-h-auto"
          />
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-3 sm:p-3 rounded-lg transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center ${
            isExpanded
              ? "bg-yellow-100 text-yellow-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
          title="Toggle advanced filters"
        >
          <Sliders className="w-5 h-5" />
        </button>
      </div>

      {/* Advanced Filters */}
      {isExpanded && (
        <div className="border-t border-gray-100 pt-4 sm:pt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Bedrooms */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-2 uppercase tracking-wide">
                Min Bedrooms
              </label>
              <select
                value={filters.minBedrooms !== null ? String(filters.minBedrooms) : ""}
                onChange={(e) =>
                  handleFilterChange({
                    minBedrooms: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors cursor-pointer min-h-[44px]"
              >
                <option value="">Any</option>
                <option value="0">Studio</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-2 uppercase tracking-wide">
                Max Bedrooms
              </label>
              <select
                value={filters.maxBedrooms !== null ? String(filters.maxBedrooms) : ""}
                onChange={(e) =>
                  handleFilterChange({
                    maxBedrooms: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors cursor-pointer min-h-[44px]"
              >
                <option value="">Any</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5+</option>
              </select>
            </div>

            {/* Rent Range */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-2 uppercase tracking-wide">
                Min Rent
              </label>
              <input
                type="number"
                placeholder="$"
                value={filters.minRent ?? ""}
                onChange={(e) =>
                  handleFilterChange({
                    minRent: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors min-h-[44px]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-2 uppercase tracking-wide">
                Max Rent
              </label>
              <input
                type="number"
                placeholder="$"
                value={filters.maxRent ?? ""}
                onChange={(e) =>
                  handleFilterChange({
                    maxRent: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors min-h-[44px]"
              />
            </div>
          </div>

          {/* Reset Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleReset}
              disabled={!hasActiveFilters}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 min-h-[44px] ${
                hasActiveFilters
                  ? "bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              <X className="w-4 h-4" />
              Clear Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

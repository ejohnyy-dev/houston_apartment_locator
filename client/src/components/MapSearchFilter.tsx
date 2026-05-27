import { useState, useCallback } from "react";
import { Search, Sliders } from "lucide-react";

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

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      {/* Search Bar */}
      <div className="flex gap-2 items-center mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name or neighborhood..."
            value={filters.searchText}
            onChange={(e) => handleFilterChange({ searchText: e.target.value })}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-600 text-sm"
          />
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Toggle advanced filters"
        >
          <Sliders className="w-5 h-5" />
        </button>
      </div>

      {/* Advanced Filters */}
      {isExpanded && (
        <div className="border-t pt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Bedrooms */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              Min Bedrooms
            </label>
            <select
              value={filters.minBedrooms ?? ""}
              onChange={(e) =>
                handleFilterChange({
                  minBedrooms: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-yellow-600"
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
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              Max Bedrooms
            </label>
            <select
              value={filters.maxBedrooms ?? ""}
              onChange={(e) =>
                handleFilterChange({
                  maxBedrooms: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-yellow-600"
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
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              Min Rent
            </label>
            <input
              type="number"
              placeholder="Min"
              value={filters.minRent ?? ""}
              onChange={(e) =>
                handleFilterChange({
                  minRent: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-yellow-600"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              Max Rent
            </label>
            <input
              type="number"
              placeholder="Max"
              value={filters.maxRent ?? ""}
              onChange={(e) =>
                handleFilterChange({
                  maxRent: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-yellow-600"
            />
          </div>

          {/* Reset Button */}
          <div className="col-span-2 md:col-span-4 flex justify-end">
            <button
              onClick={handleReset}
              className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

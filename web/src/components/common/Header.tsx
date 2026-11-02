import React, { useState } from 'react';
import type { CitySummary } from '../../api/types';
import { api } from '../../api/client';
import {
  Compass,
  Search,
  Database,
  MapPin,
  ChevronDown,
  Download,
} from 'lucide-react';
import { ReportButton } from '../report/ReportButton';

interface HeaderProps {
  cities: CitySummary[];
  activeCitySlug: string;
  onSelectCity: (slug: string) => void;
  onOpenProvenance: () => void;
  onOpenDownloads?: () => void;
  onNavigateCoords: (coords: [number, number]) => void;
}

export const Header: React.FC<HeaderProps> = ({
  cities,
  activeCitySlug,
  onSelectCity,
  onOpenProvenance,
  onOpenDownloads,
  onNavigateCoords,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);

  // Parse typed "lat, lon" or "lon, lat" in the browser (Section 1 #13)
  const parseCoordinates = (input: string): [number, number] | null => {
    const trimmed = input.trim();
    // Match "28.53, 77.08" or "28.53 77.08"
    const match = trimmed.match(/^([-+]?[0-9]*\.?[0-9]+)[,\s]+([-+]?[0-9]*\.?[0-9]+)$/);
    if (!match) return null;

    const val1 = parseFloat(match[1]);
    const val2 = parseFloat(match[2]);

    // Check which one is likely latitude (-90 to 90) vs longitude (-180 to 180)
    // For India (Delhi AOI): lat ~28, lon ~77
    if (val1 >= 20 && val1 <= 40 && val2 >= 65 && val2 <= 100) {
      return [val2, val1]; // [lon, lat]
    }
    if (val2 >= 20 && val2 <= 40 && val1 >= 65 && val1 <= 100) {
      return [val1, val2]; // [lon, lat]
    }

    // Default assume lat, lon input -> convert to [lon, lat] for MapLibre
    return [val2, val1];
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // First: Check if browser can parse direct lat, lon
    const directCoords = parseCoordinates(searchQuery);
    if (directCoords) {
      onNavigateCoords(directCoords);
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    // Otherwise: query API for places
    try {
      setIsSearching(true);
      const res = await api.searchPlaces(searchQuery);
      setSearchResults(res);
      if (res.length > 0 && res[0].center) {
        onNavigateCoords(res[0].center);
      }
    } catch (err) {
      console.warn('Place search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const activeCity = cities.find((c) => c.slug === activeCitySlug) || cities[0];

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shadow-xs z-30">
      {/* Brand & City Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold tracking-tight shadow-xs">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-gray-900 tracking-tight leading-none">
              DharaDrishti
            </h1>
            <p className="text-[10px] text-gray-500 font-medium leading-tight">
              Land Subsidence Mapping
            </p>
          </div>
        </div>

        {/* City Switcher */}
        <div className="relative">
          <button
            onClick={() => setIsOpenDropdown(!isOpenDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-800 transition shadow-2xs"
          >
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            <span>{activeCity ? activeCity.name : 'Select City'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {isOpenDropdown && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-40 text-xs">
              {cities.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => {
                    onSelectCity(c.slug);
                    setIsOpenDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-gray-50 ${
                    c.slug === activeCitySlug ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-gray-700'
                  }`}
                >
                  <span>{c.name}</span>
                  <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-gray-100 font-mono text-gray-500">
                    {c.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search Bar (Place search + typed coordinate parsing) */}
      <div className="flex-1 max-w-md mx-6">
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search place or type 'lat, lon' (e.g. 28.53, 77.08)..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
          {isSearching && (
            <span className="absolute right-3 top-2 text-[10px] text-gray-400">...</span>
          )}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 text-xs">
              {searchResults.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (item.center) onNavigateCoords(item.center);
                    setSearchResults([]);
                    setSearchQuery(item.name);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center justify-between"
                >
                  <span className="truncate">{item.name}</span>
                  <span className="text-[10px] text-gray-400 font-mono capitalize">{item.type}</span>
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* Right Controls: Downloads, Report, Provenance */}
      <div className="flex items-center gap-2">
        {onOpenDownloads && (
          <button
            onClick={onOpenDownloads}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition shadow-2xs"
            title="Download GIS rasters, GeoJSON, and time series data"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Downloads</span>
          </button>
        )}

        <ReportButton citySlug={activeCitySlug} />

        <button
          onClick={onOpenProvenance}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition shadow-2xs"
          title="Inspect sensor provenance, processor versions, and interferogram counts"
        >
          <Database className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Provenance</span>
        </button>
      </div>
    </header>
  );
};


import React from 'react';
import type { HotspotsGeoJSON, HotspotProperties } from '../../api/types';
import { Flame, ChevronRight } from 'lucide-react';

interface HotspotListProps {
  hotspots: HotspotsGeoJSON | null | undefined;
  isLoading: boolean;
  selectedId: string | null;
  onSelectHotspot: (feature: any) => void;
}

export const HotspotList: React.FC<HotspotListProps> = ({
  hotspots,
  isLoading,
  selectedId,
  onSelectHotspot,
}) => {
  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
        <div className="h-14 bg-gray-100 rounded animate-pulse" />
        <div className="h-14 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  const features = hotspots?.features || [];
  // Sort by highest negative subsidence rate (fastest subsidence first)
  const sorted = [...features].sort((a, b) => {
    const rateA = a.properties?.mean_rate ?? 0;
    const rateB = b.properties?.mean_rate ?? 0;
    return rateA - rateB;
  });

  if (sorted.length === 0) {
    return (
      <div className="p-4 text-xs text-gray-500 italic text-center">
        No active subsidence hotspots detected above significance threshold.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-red-500" />
          Ranked Hotspots ({sorted.length})
        </span>
        <span className="text-[10px] text-gray-400">LOS Rate</span>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {sorted.map((feature, idx) => {
          const props = feature.properties as HotspotProperties;
          const isSelected = selectedId === String(props.id);

          return (
            <button
              key={props.id || idx}
              type="button"
              onClick={() => onSelectHotspot(feature)}
              className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                isSelected
                  ? 'bg-red-50/80 border-red-400 shadow-xs'
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div>
                  <div className="text-xs font-semibold text-gray-900">
                    {typeof props.name === 'string' ? props.name : `Hotspot #${props.id}`}
                  </div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-2 mt-0.5">
                    <span>Area: {props.area_km2} km²</span>
                    <span>•</span>
                    <span>SNR: {props.snr?.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              <div className="text-right flex items-center gap-1.5">
                <div>
                  <div className="text-xs font-bold font-mono text-red-600">
                    {props.mean_rate} <span className="text-[9px] font-normal">mm/yr</span>
                  </div>
                  <div className="text-[9px] font-mono text-gray-400">
                    max {props.max_rate}
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};


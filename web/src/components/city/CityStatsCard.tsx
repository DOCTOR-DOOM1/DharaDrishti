import React from 'react';
import type { CityDetailSummary } from '../../api/types';
import { ShieldCheck, MapPin, Calendar, TrendingDown, Target } from 'lucide-react';

interface CityStatsCardProps {
  summary: CityDetailSummary | null | undefined;
  isLoading: boolean;
}

export const CityStatsCard: React.FC<CityStatsCardProps> = ({ summary, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-4 bg-white border border-gray-200 rounded-lg animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
            City InSAR Summary
          </h3>
        </div>
        <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
          v{summary.version}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Fastest Subsidence Rate */}
        <div className="p-2.5 bg-red-50/60 border border-red-100 rounded-lg">
          <div className="flex items-center gap-1 text-[10px] uppercase font-semibold text-red-700">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Peak Rate</span>
          </div>
          <div className="text-sm font-bold font-mono text-red-900 mt-1">
            {summary.fastest_rate.value} ± {summary.fastest_rate.sigma}{' '}
            <span className="text-[10px] font-normal">mm/yr</span>
          </div>
        </div>

        {/* Significant Motion Share */}
        <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg">
          <div className="text-[10px] uppercase font-semibold text-gray-500">
            Significant Area
          </div>
          <div className="text-sm font-bold font-mono text-gray-900 mt-1">
            {(summary.share_significant_motion * 100).toFixed(1)}%
          </div>
        </div>

        {/* Hotspot Area */}
        <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg">
          <div className="text-[10px] uppercase font-semibold text-gray-500">
            Hotspots Area
          </div>
          <div className="text-sm font-bold font-mono text-gray-900 mt-1">
            {summary.hotspot_area_km2.toFixed(1)}{' '}
            <span className="text-[10px] font-normal">km²</span>
          </div>
        </div>

        {/* Coverage Percentage */}
        <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg">
          <div className="text-[10px] uppercase font-semibold text-gray-500">
            Temporal Coverage
          </div>
          <div className="text-sm font-bold font-mono text-gray-900 mt-1">
            {summary.coverage_pct.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Meta context info */}
      <div className="space-y-1.5 pt-1 border-t border-gray-100 text-[11px] text-gray-600">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-gray-500">
            <Calendar className="w-3 h-3 text-gray-400" /> Span:
          </span>
          <span className="font-mono text-gray-800">
            {summary.data_span.start} to {summary.data_span.end}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-gray-500">
            <MapPin className="w-3 h-3 text-gray-400" /> Reference Point:
          </span>
          <span className="font-mono text-gray-800">
            {summary.reference_point.lon.toFixed(3)}°, {summary.reference_point.lat.toFixed(3)}° ({summary.reference_point.mode})
          </span>
        </div>

        {summary.noise_floor_mm_yr !== null && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-gray-500">
              <ShieldCheck className="w-3 h-3 text-gray-400" /> Noise Floor:
            </span>
            <span className="font-mono text-gray-800">
              ±{summary.noise_floor_mm_yr.toFixed(1)} mm/yr ({summary.significance_multiple}× σ)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};


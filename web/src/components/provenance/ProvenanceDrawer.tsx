import React from 'react';
import type { CityDetailSummary } from '../../api/types';
import { Database, X, CheckCircle2, XCircle, FileText, Satellite } from 'lucide-react';

interface ProvenanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  summary: CityDetailSummary | null | undefined;
}

export const ProvenanceDrawer: React.FC<ProvenanceDrawerProps> = ({
  isOpen,
  onClose,
  summary,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-gray-900">InSAR Data Provenance</h2>
              <p className="text-xs text-gray-500">Processing history & sensor audit trail</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-gray-700">
          {!summary ? (
            <div className="text-center py-10 text-gray-400">Loading provenance metadata...</div>
          ) : (
            <>
              {/* Sensor & Acquisition */}
              <div className="space-y-2">
                <h3 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Satellite className="w-3.5 h-3.5 text-blue-500" /> Sensor & Geometry
                </h3>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Satellite Mission:</span>
                    <span className="font-semibold">{summary.sensor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Track & Orbit Direction:</span>
                    <span className="font-mono">
                      Track {summary.track} ({summary.direction})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Multi-looking (Az × Rng):</span>
                    <span className="font-mono">{summary.looks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Acquisition Span:</span>
                    <span className="font-mono">
                      {summary.data_span.start} to {summary.data_span.end}
                    </span>
                  </div>
                </div>
              </div>

              {/* Processing Pipeline & Software */}
              <div className="space-y-2">
                <h3 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-500" /> Pipeline Software Versions
                </h3>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">InSAR Processor:</span>
                    <span className="font-mono font-medium">{summary.processor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Time-Series Inversion:</span>
                    <span className="font-mono font-medium">{summary.mintpy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Atmospheric Correction:</span>
                    <span className="font-semibold uppercase tracking-wide text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-[10px]">
                      {summary.atmosphere}
                    </span>
                  </div>
                </div>
              </div>

              {/* Interferogram Network Statistics */}
              <div className="space-y-2">
                <h3 className="font-bold text-gray-900 uppercase tracking-wider text-[11px]">
                  Interferogram Network Quality
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 bg-gray-50 border border-gray-200 rounded text-center">
                    <div className="text-[10px] text-gray-500 uppercase font-semibold">Ordered</div>
                    <div className="text-base font-bold font-mono text-gray-800 mt-0.5">
                      {summary.n_interferograms.ordered}
                    </div>
                  </div>
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-center">
                    <div className="text-[10px] text-emerald-700 uppercase font-semibold flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Accepted
                    </div>
                    <div className="text-base font-bold font-mono text-emerald-800 mt-0.5">
                      {summary.n_interferograms.accepted}
                    </div>
                  </div>
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded text-center">
                    <div className="text-[10px] text-red-700 uppercase font-semibold flex items-center justify-center gap-1">
                      <XCircle className="w-3 h-3" /> Rejected
                    </div>
                    <div className="text-base font-bold font-mono text-red-800 mt-0.5">
                      {summary.n_interferograms.rejected}
                    </div>
                  </div>
                </div>
              </div>

              {/* Reference Station Context */}
              <div className="space-y-2">
                <h3 className="font-bold text-gray-900 uppercase tracking-wider text-[11px]">
                  Geodetic Reference Point
                </h3>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-1.5 text-gray-600">
                  <div className="flex justify-between font-mono">
                    <span>Coordinates:</span>
                    <span>
                      {summary.reference_point.lon.toFixed(4)}°E,{' '}
                      {summary.reference_point.lat.toFixed(4)}°N
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Selection Mode:</span>
                    <span className="capitalize font-semibold">{summary.reference_point.mode}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 pt-1 leading-snug">
                    All velocities are reported line-of-sight relative to this reference station
                    located in a stable, high-coherence urban zone.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded text-xs font-semibold transition"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
};


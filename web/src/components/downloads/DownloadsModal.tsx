import React from 'react';
import { api } from '../../api/client';
import { Download, FileSpreadsheet, Layers, MapPin, X, AlertTriangle } from 'lucide-react';

interface DownloadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  citySlug: string;
  cityName: string;
  isSynthetic: boolean;
}

interface DownloadItem {
  kind: string;
  name: string;
  format: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  approxSize: string;
}

const DOWNLOAD_ITEMS: DownloadItem[] = [
  {
    kind: 'velocity_cog',
    name: 'LOS Velocity Raster',
    format: 'Cloud-Optimized GeoTIFF (COG)',
    description: 'Line-of-sight velocity field in mm/yr (EPSG:4326, float32, nodata -9999).',
    icon: Layers,
    approxSize: '~4.2 MB',
  },
  {
    kind: 'velocity_sigma_cog',
    name: 'Velocity Uncertainty Raster',
    format: 'Cloud-Optimized GeoTIFF (COG)',
    description: 'Standard error of velocity estimate in mm/yr.',
    icon: Layers,
    approxSize: '~4.2 MB',
  },
  {
    kind: 'hotspots_geojson',
    name: 'Subsidence Hotspots Callset',
    format: 'GeoJSON',
    description: 'Ranked significant deformation clusters with mean/max rates and SNR.',
    icon: MapPin,
    approxSize: '~150 KB',
  },
  {
    kind: 'risk_zones_geojson',
    name: 'Risk Screening Zones',
    format: 'GeoJSON',
    description: 'Heuristic risk index combining velocity, gradient, and density.',
    icon: AlertTriangle,
    approxSize: '~210 KB',
  },
  {
    kind: 'timeseries_csv',
    name: 'Displacement Time Series Sample',
    format: 'CSV',
    description: 'Epoch-by-epoch displacement (mm) with 1-sigma uncertainty.',
    icon: FileSpreadsheet,
    approxSize: '~45 KB',
  },
];

export const DownloadsModal: React.FC<DownloadsModalProps> = ({
  isOpen,
  onClose,
  citySlug,
  cityName,
  isSynthetic,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="downloads-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            <h2 id="downloads-modal-title" className="text-sm font-bold text-gray-900">
              Download Published Products — {cityName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"
            aria-label="Close download modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto max-h-[70vh] space-y-3">
          {isSynthetic && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Synthetic Test Fixture Notice: </span>
                <span>
                  Downloaded rasters and data files are synthetic benchmark fixtures, not real SAR
                  measurements.
                </span>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-600">
            Download immutable GIS rasters and vector datasets published for city{' '}
            <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded font-mono text-[11px]">
              {citySlug}
            </code>
            :
          </p>

          <div className="space-y-2.5">
            {DOWNLOAD_ITEMS.map((item) => {
              const Icon = item.icon;
              const downloadUrl = api.getDownloadUrl(citySlug, item.kind);

              return (
                <div
                  key={item.kind}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center shrink-0 group-hover:bg-blue-100 group-hover:text-blue-700 transition">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                        <span>{item.name}</span>
                        <span className="text-[10px] text-gray-400 font-mono font-normal">
                          ({item.approxSize})
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500">{item.description}</div>
                      <div className="text-[10px] text-blue-600 font-mono mt-0.5">
                        Format: {item.format}
                      </div>
                    </div>
                  </div>

                  <a
                    href={downloadUrl}
                    download
                    className="ml-3 shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:border-blue-600 hover:bg-blue-600 hover:text-white text-xs font-semibold text-gray-700 transition shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-[11px] text-gray-500">
          <span>Units: mm/yr LOS relative to reference point</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};


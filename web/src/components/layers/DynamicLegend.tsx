import React from 'react';
import type { LayerDefinition } from '../../api/types';

interface DynamicLegendProps {
  layers: LayerDefinition[];
  activeLayerIds: string[];
}

export const DynamicLegend: React.FC<DynamicLegendProps> = ({ layers, activeLayerIds }) => {
  const activeLayers = layers.filter((l) => activeLayerIds.includes(l.id));

  if (activeLayers.length === 0) {
    return (
      <div className="p-3 text-xs text-gray-500 italic text-center">
        Select a layer above to view its scale and legend
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeLayers.map((layer) => {
        const { legend, label, group } = layer;
        const palette = legend.palette || [];
        const isDiverging = legend.min < 0 && legend.max > 0;

        return (
          <div
            key={layer.id}
            className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-2 shadow-sm"
          >
            <div className="flex items-center justify-between font-semibold text-gray-800">
              <span>{label}</span>
              {legend.unit ? (
                <span className="text-gray-500 font-mono text-[11px]">[{legend.unit}]</span>
              ) : null}
            </div>

            {/* Gradient bar / Palette swatches */}
            {palette.length > 0 && (() => {
              const zeroPercent = isDiverging
                ? Math.max(0, Math.min(100, ((0 - legend.min) / (legend.max - legend.min)) * 100))
                : null;
              return (
                <div className="space-y-1">
                  {/* Gradient bar with optional 0-tick */}
                  <div
                    className="relative h-3 w-full rounded border border-gray-300"
                    style={{ background: `linear-gradient(to right, ${palette.join(', ')})` }}
                  >
                    {zeroPercent !== null && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-white/80"
                        style={{ left: `${zeroPercent}%` }}
                        title="0"
                      />
                    )}
                  </div>
                  {/* Label row: min, 0 at exact position, max */}
                  <div className="relative h-3 text-[10px] text-gray-600 font-mono">
                    <span className="absolute left-0">{legend.min}</span>
                    {zeroPercent !== null && (
                      <span
                        className="absolute -translate-x-1/2"
                        style={{ left: `${zeroPercent}%` }}
                      >
                        0
                      </span>
                    )}
                    <span className="absolute right-0">{legend.max}</span>
                  </div>
                </div>
              );
            })()}

            {/* Note & Disclaimers from API */}
            {legend.note && (
              <div
                className={`text-[11px] leading-relaxed p-2 rounded ${
                  group === 'risk'
                    ? 'bg-amber-50 border border-amber-200 text-amber-900 font-medium'
                    : 'text-gray-600 bg-white/70 border border-gray-200/60'
                }`}
              >
                {legend.note}
              </div>
            )}

            {layer.provenance && (
              <div className="text-[10px] text-gray-400 font-mono">
                Source: {layer.provenance}
              </div>
            )}
          </div>
        );
      })}

      {/* Masked pixel swatch: Hardcoded label 'No reliable measurement here' */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-200 text-[11px] text-gray-600">
        <div className="w-3.5 h-3.5 rounded border border-gray-300 bg-gray-200/60 flex items-center justify-center shrink-0">
          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
        </div>
        <span>No reliable measurement here (Masked)</span>
      </div>
    </div>
  );
};


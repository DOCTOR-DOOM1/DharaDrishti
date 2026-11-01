import React from 'react';
import type { LayerDefinition, LayerGroup } from '../../api/types';
import { Eye, EyeOff, Layers, AlertCircle } from 'lucide-react';

interface LayerPanelProps {
  layers: LayerDefinition[];
  activeLayerIds: string[];
  layerOpacities: Record<string, number>;
  onToggleLayer: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
}

const GROUP_LABELS: Record<LayerGroup, { title: string; badge: string; color: string }> = {
  measured: {
    title: 'Measured InSAR',
    badge: 'Measurement',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  derived: {
    title: 'Derived Science',
    badge: 'Analytical',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  risk: {
    title: 'Risk (Heuristic)',
    badge: 'Screening Only',
    color: 'bg-amber-50 text-amber-800 border-amber-300',
  },
};

export const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  activeLayerIds,
  layerOpacities,
  onToggleLayer,
  onOpacityChange,
}) => {
  const groups: LayerGroup[] = ['measured', 'derived', 'risk'];

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const groupLayers = layers.filter((l) => l.group === group);
        if (groupLayers.length === 0) return null;
        const meta = GROUP_LABELS[group];

        return (
          <div key={group} className="space-y-2">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-gray-500" />
                {meta.title}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase ${meta.color}`}
              >
                {meta.badge}
              </span>
            </div>

            <div className="space-y-2">
              {groupLayers.map((layer) => {
                const isActive = activeLayerIds.includes(layer.id);
                const opacity = layerOpacities[layer.id] ?? 0.85;

                return (
                  <div
                    key={layer.id}
                    className={`p-2.5 rounded-lg border transition-all ${
                      isActive
                        ? 'bg-white border-blue-400 shadow-sm'
                        : 'bg-gray-50/70 border-gray-200 text-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => onToggleLayer(layer.id)}
                        className="flex items-center gap-2 text-left flex-1 font-medium text-xs hover:text-blue-600 focus:outline-none"
                      >
                        {isActive ? (
                          <Eye className="w-4 h-4 text-blue-600 shrink-0" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-gray-400 shrink-0" />
                        )}
                        <span className={isActive ? 'text-gray-900 font-semibold' : 'text-gray-600'}>
                          {layer.label}
                        </span>
                      </button>

                      {group === 'risk' && (
                        <span
                          title={layer.legend.note}
                          className="text-amber-600 p-0.5 hover:bg-amber-100 rounded cursor-help"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    {isActive && (
                      <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center gap-3 text-[11px] text-gray-500">
                        <span className="w-12 shrink-0">Opacity</span>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={opacity}
                          onChange={(e) => onOpacityChange(layer.id, parseFloat(e.target.value))}
                          className="w-full accent-blue-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                        />
                        <span className="w-8 font-mono text-right text-gray-700">
                          {Math.round(opacity * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};


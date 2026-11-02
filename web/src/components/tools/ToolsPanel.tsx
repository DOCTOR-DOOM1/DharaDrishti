import React, { useState } from 'react';
import type { MountedViewModule, ViewProps } from '../../api/types';
import { Wrench, ChevronRight, Box } from 'lucide-react';

interface ToolsPanelProps {
  views: MountedViewModule[];
  loading: boolean;
  viewProps: ViewProps;
}

export const ToolsPanel: React.FC<ToolsPanelProps> = ({ views, loading, viewProps }) => {
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  if (loading) {
    return <div className="p-4 text-xs text-gray-500 animate-pulse">Scanning views...</div>;
  }

  const activeView = views.find((v) => v.id === activeViewId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-blue-600" />
          External View Mounts ({views.length})
        </span>
        <span className="text-[10px] text-gray-400 font-mono">views-*</span>
      </div>

      {views.length === 0 ? (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center space-y-1.5">
          <Box className="w-6 h-6 text-gray-400 mx-auto" />
          <p className="text-xs font-medium text-gray-700">No external views mounted yet</p>
          <p className="text-[11px] text-gray-500 leading-snug">
            Views placed by Yash in <code className="font-mono text-gray-700">views-sar/</code> and
            Shivani in <code className="font-mono text-gray-700">views-science/</code> will
            automatically appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* View list / tabs */}
          <div className="space-y-1">
            {views.map((v) => {
              const isSelected = activeViewId === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setActiveViewId(isSelected ? null : v.id)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-400 text-blue-900 shadow-xs'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>{v.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                      {v.group}
                    </span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 text-gray-400 transform transition-transform ${
                        isSelected ? 'rotate-90' : ''
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active view container */}
          {activeView && (
            <div className="mt-3 p-3.5 bg-white border border-blue-200 rounded-lg shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
                <span className="text-xs font-bold text-gray-900">{activeView.title}</span>
                <span className="text-[10px] text-gray-400 font-mono">id: {activeView.id}</span>
              </div>
              <div className="text-xs">
                {React.createElement(activeView.Component, viewProps)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


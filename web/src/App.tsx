import { useState, useMemo, useCallback } from 'react';
import {
  useCities,
  useCitySummary,
  useLayers,
  useHotspots,
  useTimeSeries,
  useSnapshots,
} from './api/queries';
import { useUrlState } from './hooks/useUrlState';
import { useViewDiscovery } from './hooks/useViewDiscovery';
import { SyntheticBanner } from './components/common/SyntheticBanner';
import { Header } from './components/common/Header';
import { LayerPanel } from './components/layers/LayerPanel';
import { DynamicLegend } from './components/layers/DynamicLegend';
import { HotspotList } from './components/hotspots/HotspotList';
import { CityStatsCard } from './components/city/CityStatsCard';
import { ProvenanceDrawer } from './components/provenance/ProvenanceDrawer';
import { ToolsPanel } from './components/tools/ToolsPanel';
import { MapContainer } from './components/map/MapContainer';
import { TimeSeriesChart } from './components/chart/TimeSeriesChart';
import { EpochSlider } from './components/timeline/EpochSlider';
import { DownloadsModal } from './components/downloads/DownloadsModal';
import { API_BASE_URL } from './api/client';
import type { ViewProps } from './api/types';
import { Layers, Flame, Wrench, ChevronLeft, ChevronRight } from 'lucide-react';

export function App() {
  const { urlState, updateUrl } = useUrlState('delhi-ncr', ['velocity']);
  const activeCitySlug = urlState.city;

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'layers' | 'hotspots' | 'tools'>('layers');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProvenanceOpen, setIsProvenanceOpen] = useState(false);
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);

  // Queries
  const { data: cities = [] } = useCities();
  const { data: summary, isLoading: isSummaryLoading } = useCitySummary(activeCitySlug);
  const { data: layers = [] } = useLayers(activeCitySlug);
  const { data: hotspots, isLoading: isHotspotsLoading } = useHotspots(activeCitySlug);
  const { data: snapshots = [], isLoading: isSnapshotsLoading } = useSnapshots(activeCitySlug);

  // Layer state
  const activeLayerIds = urlState.layers;
  const [layerOpacities, setLayerOpacities] = useState<Record<string, number>>({
    velocity: 0.85,
  });

  const handleToggleLayer = (layerId: string) => {
    const isCurrentlyActive = activeLayerIds.includes(layerId);
    let next: string[];
    if (isCurrentlyActive) {
      next = activeLayerIds.filter((id) => id !== layerId);
    } else {
      next = [...activeLayerIds, layerId];
    }
    updateUrl({ layers: next });
  };

  const handleOpacityChange = (layerId: string, opacity: number) => {
    setLayerOpacities((prev) => ({ ...prev, [layerId]: opacity }));
  };

  // Coordinates & Time Series
  const selectedCoords = urlState.coords;
  const {
    data: timeSeriesData,
    isLoading: isTimeSeriesLoading,
    error: timeSeriesError,
  } = useTimeSeries(
    activeCitySlug,
    selectedCoords ? selectedCoords[0] : null,
    selectedCoords ? selectedCoords[1] : null
  );

  const handleMapClick = (coords: [number, number]) => {
    updateUrl({ coords });
  };

  const [selectedFeature, setSelectedFeature] = useState<any | null>(null);

  const handleSelectHotspot = (feature: any) => {
    setSelectedFeature(feature);
    const coords = feature.geometry?.coordinates?.[0]?.[0];
    if (coords && Array.isArray(coords)) {
      updateUrl({ coords: [coords[0], coords[1]], selectedId: String(feature.properties?.id) });
    }
  };

  // View Discovery & Tools Integration (Section 3.11)
  const { views, loading: isViewsLoading } = useViewDiscovery();

  const flyToBbox = useCallback((bbox: [number, number, number, number]) => {
    const centerLon = (bbox[0] + bbox[2]) / 2;
    const centerLat = (bbox[1] + bbox[3]) / 2;
    updateUrl({ coords: [centerLon, centerLat] });
  }, [updateUrl]);

  const viewProps: ViewProps = useMemo(() => {
    return {
      apiUrl: API_BASE_URL,
      city: activeCitySlug,
      version: summary?.version ?? 1,
      selectedFeature,
      flyTo: flyToBbox,
      selectFeature: setSelectedFeature,
    };
  }, [activeCitySlug, summary?.version, selectedFeature, flyToBbox]);

  // Persistent Synthetic Banner Trigger
  const isSynthetic = Boolean(
    summary?.synthetic ||
    cities.find((c) => c.slug === activeCitySlug)?.synthetic ||
    timeSeriesData?.synthetic
  );

  const activeCity = cities.find((c) => c.slug === activeCitySlug);
  const bbox: [number, number, number, number] = activeCity?.bbox || [76.95, 28.30, 77.40, 28.65];

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-100 text-gray-900 select-none overflow-hidden">
      {/* 1. Persistent Synthetic Banner */}
      <SyntheticBanner isSynthetic={isSynthetic} />

      {/* 2. Top Navigation Bar */}
      <Header
        cities={cities}
        activeCitySlug={activeCitySlug}
        onSelectCity={(slug) => updateUrl({ city: slug, coords: null, selectedId: null })}
        onOpenProvenance={() => setIsProvenanceOpen(true)}
        onOpenDownloads={() => setIsDownloadsOpen(true)}
        onNavigateCoords={(coords) => updateUrl({ coords })}
      />

      {/* 3. Main Workspace */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Control Sidebar */}
        <div
          className={`bg-white border-r border-gray-200 flex flex-col z-20 shadow-md transition-all duration-300 ${
            isSidebarOpen ? 'w-full sm:w-88 absolute sm:relative inset-y-0 left-0' : 'w-0 border-r-0'
          }`}
        >
          {isSidebarOpen && (
            <>
              {/* Sidebar Tabs */}
              <div className="flex border-b border-gray-200 bg-gray-50/70 p-1">
                <button
                  onClick={() => setActiveTab('layers')}
                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition ${
                    activeTab === 'layers'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Layers</span>
                </button>

                <button
                  onClick={() => setActiveTab('hotspots')}
                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition ${
                    activeTab === 'hotspots'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Hotspots</span>
                </button>

                <button
                  onClick={() => setActiveTab('tools')}
                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition ${
                    activeTab === 'tools'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Tools</span>
                  {views.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                      {views.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Sidebar Tab Panels */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                {activeTab === 'layers' && (
                  <>
                    <LayerPanel
                      layers={layers}
                      activeLayerIds={activeLayerIds}
                      layerOpacities={layerOpacities}
                      onToggleLayer={handleToggleLayer}
                      onOpacityChange={handleOpacityChange}
                    />

                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Legend & Color Scales
                      </div>
                      <DynamicLegend layers={layers} activeLayerIds={activeLayerIds} />
                    </div>
                  </>
                )}

                {activeTab === 'hotspots' && (
                  <>
                    <CityStatsCard summary={summary} isLoading={isSummaryLoading} />
                    <HotspotList
                      hotspots={hotspots}
                      isLoading={isHotspotsLoading}
                      selectedId={urlState.selectedId}
                      onSelectHotspot={handleSelectHotspot}
                    />
                  </>
                )}

                {activeTab === 'tools' && (
                  <ToolsPanel views={views} loading={isViewsLoading} viewProps={viewProps} />
                )}
              </div>
            </>
          )}
        </div>

        {/* Sidebar Toggle Tab */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute top-3 z-30 bg-white border border-gray-200 rounded-r-md p-1 shadow-sm text-gray-600 hover:text-gray-900 transition"
          style={{ left: isSidebarOpen ? '22rem' : '0' }}
          title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isSidebarOpen ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {/* Center: Map Area */}
        <div className="flex-1 h-full relative">
          <MapContainer
            bbox={bbox}
            selectedCoords={selectedCoords}
            referencePoint={summary?.reference_point}
            layers={layers}
            activeLayerIds={activeLayerIds}
            layerOpacities={layerOpacities}
            hotspots={hotspots}
            selectedFeature={selectedFeature}
            selectedId={urlState.selectedId}
            onMapClick={handleMapClick}
            onFeatureSelect={handleSelectHotspot}
          />

          {/* Right Floating Time Series Card */}
          {selectedCoords && (
            <div className="absolute top-3 right-3 left-3 sm:left-auto sm:w-96 max-h-[85vh] overflow-y-auto z-20 shadow-xl rounded-lg">
              <TimeSeriesChart
                data={timeSeriesData}
                isLoading={isTimeSeriesLoading}
                error={timeSeriesError}
                lon={selectedCoords[0]}
                lat={selectedCoords[1]}
                onClose={() => updateUrl({ coords: null })}
              />
            </div>
          )}

          {/* Bottom Floating Epoch Timeline Slider */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
            <EpochSlider
              snapshots={snapshots}
              selectedEpoch={urlState.epoch}
              onSelectEpoch={(epoch) => updateUrl({ epoch })}
              isLoading={isSnapshotsLoading}
            />
          </div>
        </div>
      </div>

      {/* 4. Downloads Modal */}
      <DownloadsModal
        isOpen={isDownloadsOpen}
        onClose={() => setIsDownloadsOpen(false)}
        citySlug={activeCitySlug}
        cityName={activeCity?.name || activeCitySlug}
        isSynthetic={isSynthetic}
      />

      {/* 5. Provenance Drawer Modal */}
      <ProvenanceDrawer
        isOpen={isProvenanceOpen}
        onClose={() => setIsProvenanceOpen(false)}
        summary={summary}
      />
    </div>
  );
}

export default App;

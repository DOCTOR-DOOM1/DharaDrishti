import React, { useRef, useCallback, useEffect, useState } from 'react';
import Map, {
  Source,
  Layer,
  Marker,
  NavigationControl,
  type MapRef,
  type MapLayerMouseEvent,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
// maplibre-gl v6 has no default export — use namespace import.
// The namespace object satisfies the MapLib interface (Map, Marker, Popup…).
// setWorkerUrl() is called in main.tsx before any Map is created.
import * as maplibregl from 'maplibre-gl';
import type { HotspotsGeoJSON, LayerDefinition } from '../../api/types';
import { MapPin, Target } from 'lucide-react';
import { SyntheticVelocityOverlay } from './SyntheticVelocityOverlay';
import {
  HotspotMapLayer,
  type HotspotHoverInfo,
} from './HotspotMapLayer';
import { HOTSPOT_INTERACTIVE_LAYERS } from './hotspotLayerIds';

interface MapContainerProps {
  bbox: [number, number, number, number];
  selectedCoords: [number, number] | null;
  referencePoint?: { lon: number; lat: number; mode: string };
  layers: LayerDefinition[];
  activeLayerIds: string[];
  layerOpacities: Record<string, number>;
  hotspots: HotspotsGeoJSON | null | undefined;
  selectedFeature: any | null;
  selectedId: string | null;
  onMapClick: (coords: [number, number]) => void;
  onFeatureSelect: (feature: any) => void;
}

// OpenFreeMap Positron: clean, light, good contrast under coloured overlay.
// Falls back to 'bright' if Positron fails (handled via onError + state).
const STYLE_POSITRON = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_BRIGHT   = 'https://tiles.openfreemap.org/styles/bright';

/** Strip Proxy wrappers / class instances — prevents MapLibre serialisation errors. */
function toPlain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

export const MapContainer: React.FC<MapContainerProps> = ({
  bbox,
  selectedCoords,
  referencePoint,
  layers,
  activeLayerIds,
  layerOpacities,
  hotspots,
  selectedFeature,
  selectedId,
  onMapClick,
  onFeatureSelect,
}) => {
  const mapRef = useRef<MapRef | null>(null);
  const [mapStyle, setMapStyle] = useState(STYLE_POSITRON);
  const [tooltip, setTooltip] = useState<HotspotHoverInfo | null>(null);

  // Stable initial center derived from bbox — consumed once at mount
  const centerLon = (bbox[0] + bbox[2]) / 2;
  const centerLat = (bbox[1] + bbox[3]) / 2;
  const initialViewState = {
    longitude: isFinite(centerLon) ? centerLon : 77.175,
    latitude:  isFinite(centerLat) ? centerLat : 28.475,
    zoom: 10,
  };

  const flyToBbox = useCallback((box: [number, number, number, number]) => {
    mapRef.current?.fitBounds(
      [[box[0], box[1]], [box[2], box[3]]],
      { padding: 60, duration: 1200 },
    );
  }, []);

  // Fly to selected coordinate on change
  useEffect(() => {
    if (!selectedCoords || !mapRef.current) return;
    mapRef.current.flyTo({
      center: selectedCoords,
      zoom: Math.max(mapRef.current.getZoom(), 12),
      duration: 800,
    });
  }, [selectedCoords]);

  // Expose flyToBbox for App-level future use
  useEffect(() => {
    (mapRef as any)._flyToBbox = flyToBbox;
  }, [flyToBbox]);

  // ── Low-level MapLibre diagnostics (console only, no on-screen overlay) ──
  const handleLoad = useCallback((e: any) => {
    const map = e.target;
    map.on('error', (ev: any) => {
      console.error('[MapLibre error]', ev?.error?.message ?? ev?.error ?? ev);
    });
  }, []);

  // react-map-gl-level error: if Positron fails, fall back to Bright
  const handleError = useCallback((e: any) => {
    const msg: string = e?.error?.message ?? '';
    console.error('[MapLibre react error]', msg, e?.error ?? e);
    if (mapStyle === STYLE_POSITRON) {
      console.warn('[MapContainer] Positron failed — switching to bright fallback');
      setMapStyle(STYLE_BRIGHT);
    }
  }, [mapStyle]);

  // ── Map interaction handlers ──────────────────────────────────────────────

  const handleMapClick = (e: MapLayerMouseEvent) => {
    setTooltip(null);
    const feats = e.features;
    if (feats && feats.length > 0) {
      const src = feats[0].source;
      if (src === 'hotspots-source' || src === 'hotspot-centroids-source') {
        onFeatureSelect(feats[0]);
        return; // don't also fire a timeseries pin when clicking a hotspot
      }
    }
    onMapClick([e.lngLat.lng, e.lngLat.lat]);
  };

  const handleMouseMove = (e: MapLayerMouseEvent) => {
    const feat = e.features?.[0];
    if (
      feat &&
      (feat.source === 'hotspot-centroids-source' || feat.source === 'hotspots-source')
    ) {
      const props = feat.properties ?? {};
      const name     = typeof props['name'] === 'string' ? props['name'] : 'Hotspot';
      const meanRate = typeof props['mean_rate'] === 'number' ? props['mean_rate'] : 0;
      const area     = typeof props['area_km2'] === 'number' ? props['area_km2'] : 0;
      setTooltip({ name, mean_rate: meanRate, area_km2: area, x: e.point.x, y: e.point.y });
    } else {
      setTooltip(null);
    }
  };

  // ── Active raster overlays (real TiTiler, available post Sync-1) ──────────

  const rasterLayers = activeLayerIds.flatMap((layerId) => {
    const lDef = layers.find((l) => l.id === layerId);
    if (
      !lDef?.tile_url ||
      lDef.tile_url.endsWith('.geojson') ||
      !lDef.tile_url.includes('{z}') // only real TiTiler templates
    ) return [];
    const opacity = layerOpacities[layerId] ?? 0.85;
    return [(
      <Source
        key={lDef.id}
        id={`raster-source-${lDef.id}`}
        type="raster"
        tiles={[lDef.tile_url]}
        tileSize={256}
      >
        <Layer
          id={`raster-layer-${lDef.id}`}
          type="raster"
          paint={{ 'raster-opacity': opacity }}
        />
      </Source>
    )];
  });

  // Serialise selected feature to prevent MapLibre proxy errors
  const plainSelectedFeature = selectedFeature
    ? toPlain(selectedFeature)
    : null;

  return (
    <div className="relative w-full h-full bg-slate-200">
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        onClick={handleMapClick}
        onMouseMove={handleMouseMove}
        onError={handleError}
        onLoad={handleLoad}
        interactiveLayerIds={[...HOTSPOT_INTERACTIVE_LAYERS]}
        cursor={tooltip ? 'pointer' : 'crosshair'}
      >
        <NavigationControl position="bottom-right" />

        {/* Velocity overlay — synthetic canvas until real TiTiler is available */}
        <SyntheticVelocityOverlay
          layerDef={layers.find((l) => l.id === 'velocity')}
          isActive={activeLayerIds.includes('velocity')}
          opacity={layerOpacities['velocity'] ?? 0.70}
        />

        {/* Real TiTiler raster overlays (post Sync-1) */}
        {rasterLayers}

        {/* Hotspot heat blobs + rings + badges + labels */}
        <HotspotMapLayer
          hotspots={hotspots}
          selectedId={selectedId}
        />

        {/* Selected hotspot highlight outline (driven by plainSelectedFeature) */}
        {plainSelectedFeature && (
          <Source id="selected-feature-source" type="geojson" data={plainSelectedFeature}>
            <Layer
              id="selected-feature-outline"
              type="line"
              paint={{ 'line-color': '#b91c1c', 'line-width': 3.5 }}
            />
          </Source>
        )}

        {/* InSAR Reference Point Marker */}
        {referencePoint && (
          <Marker
            longitude={referencePoint.lon}
            latitude={referencePoint.lat}
            anchor="center"
          >
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600/90 text-white shadow-md border-2 border-white ring-2 ring-blue-400 cursor-help"
              title={`InSAR Reference Point: ${referencePoint.lon.toFixed(4)}, ${referencePoint.lat.toFixed(4)} (mode: ${referencePoint.mode})`}
            >
              <Target className="w-4 h-4" />
            </div>
          </Marker>
        )}

        {/* Clicked / Inspected Point Marker */}
        {selectedCoords && (
          <Marker longitude={selectedCoords[0]} latitude={selectedCoords[1]} anchor="bottom">
            <div className="flex flex-col items-center">
              <MapPin className="w-7 h-7 text-red-600 fill-red-600 drop-shadow-md" />
            </div>
          </Marker>
        )}
      </Map>

      {/* Hover tooltip (HTML overlay, not a MapLibre layer) */}
      {tooltip && (
        <div
          className="absolute z-30 pointer-events-none bg-white/95 backdrop-blur-sm border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-xs text-gray-800 max-w-[200px]"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
          role="tooltip"
        >
          <div className="font-bold text-gray-900 truncate">{tooltip.name}</div>
          <div className="mt-0.5 text-gray-600 space-y-0.5">
            <div>
              Rate:{' '}
              <span className={`font-mono font-semibold ${tooltip.mean_rate < 0 ? 'text-red-600' : 'text-green-700'}`}>
                {tooltip.mean_rate >= 0 ? '+' : ''}{tooltip.mean_rate.toFixed(1)} mm/yr
              </span>
            </div>
            <div>Area: <span className="font-mono">{tooltip.area_km2.toFixed(1)} km²</span></div>
          </div>
        </div>
      )}

      {/* Floating coordinate readout */}
      {selectedCoords && (
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-gray-200 shadow-md text-xs font-mono text-gray-800 flex items-center gap-2 z-10">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>{selectedCoords[0].toFixed(4)}°E, {selectedCoords[1].toFixed(4)}°N</span>
        </div>
      )}

      {/* Basemap attribution */}
      <div className="absolute bottom-1 left-2 text-[9px] text-gray-400 bg-white/60 px-1.5 py-0.5 rounded pointer-events-none">
        Basemap: OpenFreeMap ({mapStyle === STYLE_POSITRON ? 'Positron' : 'Bright'})
      </div>
    </div>
  );
};

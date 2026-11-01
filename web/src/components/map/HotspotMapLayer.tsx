/**
 * HotspotMapLayer.tsx
 *
 * Renders hotspot annotations inside the MapLibre map:
 *  - Soft heat blob per hotspot (large blurred circle, indicates severity)
 *  - White ring with dark halo around each centroid (visible on any basemap)
 *  - Numbered badge (rank number) at each centroid
 *  - Name + rate label visible at zoom ≥ 10
 *  - Hover tooltip (raised to parent via onHoverChange callback)
 *  - Selected hotspot gets a thicker highlight ring
 *
 * All GeoJSON passed to MapLibre is serialised through JSON.parse/stringify
 * to strip Proxy wrappers and class instances that cause the
 * "can't serialize object of unregistered class" MapLibre error.
 *
 * Lives inside web/src/components/map/ — Sohan's zone only.
 */

import React, { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { HotspotsGeoJSON } from '../../api/types';
import type { FeatureCollection, Point } from 'geojson';
export { HOTSPOT_INTERACTIVE_LAYERS } from './hotspotLayerIds';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HotspotHoverInfo {
  name: string;
  mean_rate: number;
  area_km2: number;
  x: number; // cursor position in pixels (for tooltip placement)
  y: number;
}

interface HotspotMapLayerProps {
  hotspots: HotspotsGeoJSON | null | undefined;
  selectedId: string | null;
}

// ── Centroid utilities ────────────────────────────────────────────────────────

function polygonCentroid(coords: number[][][]): [number, number] {
  const ring = coords[0];
  const n = ring.length - 1; // last point duplicates first in a closed ring
  let sumLon = 0, sumLat = 0;
  for (let i = 0; i < n; i++) { sumLon += ring[i][0]; sumLat += ring[i][1]; }
  return [sumLon / n, sumLat / n];
}

/** Ensure data passed to MapLibre is plain JSON (no Proxy, class instances, etc.) */
function toPlain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const HotspotMapLayer: React.FC<HotspotMapLayerProps> = ({
  hotspots,
  selectedId,
}) => {
  /** Plain-JSON hotspot polygons for the fill/line layer (click detection) */
  const plainHotspots = useMemo(
    () => (hotspots ? toPlain(hotspots) : null),
    [hotspots],
  );

  /** Centroid FeatureCollection — Point per hotspot, with rank + label props */
  const centroids = useMemo<FeatureCollection<Point> | null>(() => {
    if (!hotspots?.features?.length) return null;
    const features = hotspots.features.map((f, i) => {
      const geom = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
      let centLon = 0, centLat = 0;
      if (geom.type === 'Polygon') {
        [centLon, centLat] = polygonCentroid(geom.coordinates);
      } else if (geom.type === 'MultiPolygon') {
        [centLon, centLat] = polygonCentroid(geom.coordinates[0]);
      }
      const props = f.properties ?? {};
      const name  = typeof props['name'] === 'string' ? props['name'] : `Hotspot #${i + 1}`;
      const rate  = typeof props['mean_rate'] === 'number' ? props['mean_rate'] : 0;
      const area  = typeof props['area_km2'] === 'number' ? props['area_km2'] : 0;
      const id    = props['id'] ?? String(i + 1);
      return {
        type: 'Feature' as const,
        id: i, // numeric id required for feature-state
        geometry: { type: 'Point' as const, coordinates: [centLon, centLat] },
        properties: {
          id,
          rank: i + 1,
          name,
          mean_rate: rate,
          area_km2: area,
          // Formatted label: "Kapashera −88 mm/yr"
          label: `${name.split(',')[0]} ${rate >= 0 ? '+' : ''}${Math.round(rate)} mm/yr`,
        },
      };
    });
    return toPlain({ type: 'FeatureCollection', features }) as FeatureCollection<Point>;
  }, [hotspots]);

  if (!plainHotspots || !centroids) return null;

  return (
    <>
      {/* ── 1. Transparent polygon fill — primary click target ── */}
      <Source id="hotspots-source" type="geojson" data={plainHotspots}>
        <Layer
          id="hotspot-polygon-fill"
          type="fill"
          paint={{ 'fill-color': '#dc2626', 'fill-opacity': 0.07 }}
        />
        {/* Selected polygon gets a bright outline */}
        <Layer
          id="hotspot-polygon-selected"
          type="line"
          filter={selectedId ? ['==', ['get', 'id'], selectedId] : ['==', 'id', '__none__']}
          paint={{ 'line-color': '#dc2626', 'line-width': 3, 'line-opacity': 0.9 }}
        />
      </Source>

      {/* ── 2–6. Circle and symbol layers on centroid points ── */}
      <Source id="hotspot-centroids-source" type="geojson" data={centroids}>

        {/* 2. Heat blob — large, blurred, saturated circle */}
        <Layer
          id="hotspot-heat-blob"
          type="circle"
          paint={{
            'circle-radius': 44,
            'circle-color': '#dc2626',
            'circle-opacity': 0.18,
            'circle-blur': 1.0, // blur = radius fraction → very soft gaussian glow
          }}
        />

        {/* 3. Outer halo ring — dark stroke for contrast on light basemap */}
        <Layer
          id="hotspot-ring-halo"
          type="circle"
          paint={{
            'circle-radius': [
              'case',
              ['==', ['get', 'id'], selectedId ?? '__none__'], 26,
              20,
            ],
            'circle-color': 'transparent',
            'circle-stroke-width': [
              'case',
              ['==', ['get', 'id'], selectedId ?? '__none__'], 5,
              3.5,
            ],
            'circle-stroke-color': 'rgba(0,0,0,0.55)',
            'circle-opacity': 0,
          }}
        />

        {/* 4. Inner ring — white stroke, crisp boundary */}
        <Layer
          id="hotspot-ring"
          type="circle"
          paint={{
            'circle-radius': [
              'case',
              ['==', ['get', 'id'], selectedId ?? '__none__'], 26,
              20,
            ],
            'circle-color': 'transparent',
            'circle-stroke-width': [
              'case',
              ['==', ['get', 'id'], selectedId ?? '__none__'], 3,
              2,
            ],
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0,
          }}
        />

        {/* 5. Badge background — small solid circle behind rank number */}
        <Layer
          id="hotspot-badge-bg"
          type="circle"
          paint={{
            'circle-radius': 10,
            'circle-color': '#dc2626',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />

        {/* 6. Rank number — white text on the badge */}
        <Layer
          id="hotspot-badge-text"
          type="symbol"
          layout={{
            'text-field': ['to-string', ['get', 'rank']],
            'text-size': 11,
            'text-font': ['Noto Sans Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          }}
          paint={{
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.4)',
            'text-halo-width': 0.5,
          }}
        />

        {/* 7. Name + rate label — offset below ring, visible at zoom ≥ 10 */}
        <Layer
          id="hotspot-label"
          type="symbol"
          minzoom={10}
          layout={{
            'text-field': ['get', 'label'],
            'text-size': 11,
            'text-font': ['Noto Sans Regular', 'Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-offset': [0, 2.6],
            'text-anchor': 'top',
            'text-allow-overlap': false,
            'text-max-width': 12,
          }}
          paint={{
            'text-color': '#1e293b',
            'text-halo-color': 'rgba(255,255,255,0.95)',
            'text-halo-width': 2,
          }}
        />
      </Source>
    </>
  );
};


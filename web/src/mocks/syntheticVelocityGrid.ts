/**
 * syntheticVelocityGrid.ts
 *
 * Generates a GeoJSON FeatureCollection of rectangular cells covering the
 * Delhi NCR AOI, each with a synthetic LOS velocity value and a pre-computed
 * hex color derived from the layer's palette + legend min/max.
 *
 * This file lives in src/mocks/ because it is ONLY used when the real
 * TiTiler tile_url is not yet available (pre-Sync 1). It is never imported
 * by tests or by any API/backend code.
 *
 * The bowl geometry matches the mock timeseries data in handlers.ts.
 * No science is computed here — values are synthetic fixtures only.
 */

import type { FeatureCollection, Feature, Polygon } from 'geojson';

// Delhi NCR AOI (matches Section 3.2)
const AOI = {
  minLon: 76.95,
  maxLon: 77.40,
  minLat: 28.30,
  maxLat: 28.65,
};

// Grid resolution: ~70 columns × 46 rows → ~3 220 cells, ~800 m per cell
const COLS = 70;
const ROWS = 46;

// Subsidence bowls — must match the mock timeseries generator in handlers.ts
interface Bowl {
  lon: number;
  lat: number;
  peak: number;   // mm/yr LOS (negative = subsidence)
  radius: number; // degrees
}

const BOWLS: Bowl[] = [
  { lon: 77.08,  lat: 28.53,  peak: -88.4, radius: 0.048 }, // Kapashera
  { lon: 77.037, lat: 28.587, peak: -48.1, radius: 0.038 }, // Dwarka Sector 8/9
  { lon: 77.31,  lat: 28.40,  peak: -39.0, radius: 0.040 }, // Faridabad Industrial
];

const UPLIFTS: Bowl[] = [
  { lon: 77.20, lat: 28.60, peak: 4.5, radius: 0.025 }, // Connaught Place area (ref point)
  { lon: 77.36, lat: 28.55, peak: 3.0, radius: 0.018 }, // NOIDA border
];

// Masked zone: simulated river corridor / low-coherence area (matches 404 zone in handlers.ts)
function isMasked(lon: number, lat: number): boolean {
  return lon > 77.24 && lon < 77.28 && lat > 28.62 && lat < 28.66;
}

function computeVelocity(lon: number, lat: number): number | null {
  if (isMasked(lon, lat)) return null;

  let v = -1.5; // background: slight regional settlement

  for (const bowl of BOWLS) {
    const d = Math.hypot(lon - bowl.lon, lat - bowl.lat);
    if (d < bowl.radius) {
      const f = 1 - d / bowl.radius;
      v += bowl.peak * f * f; // Gaussian profile
    }
  }

  for (const up of UPLIFTS) {
    const d = Math.hypot(lon - up.lon, lat - up.lat);
    if (d < up.radius) {
      const f = 1 - d / up.radius;
      v += up.peak * f * f;
    }
  }

  return Math.round(v * 10) / 10;
}

// ── Colour utilities ──────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0');
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
  );
}

/**
 * Map a velocity value to a hex color using the layer palette.
 * The palette is treated as a linear ramp from legend.min to legend.max.
 */
export function velocityToColor(
  value: number,
  palette: string[],
  min: number,
  max: number,
): string {
  if (!palette.length) return '#888888';
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const n = palette.length - 1;
  const pos = t * n;
  const lo = Math.floor(pos);
  const hi = Math.min(n, lo + 1);
  return lerpColor(palette[lo], palette[hi], pos - lo);
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface SyntheticGridCell {
  velocity: number;
  color: string;
}

/**
 * Generate the synthetic velocity GeoJSON grid.
 *
 * @param palette  hex color array from the /layers API (legend.palette)
 * @param min      legend.min in mm/yr
 * @param max      legend.max in mm/yr
 */
export function generateSyntheticVelocityGrid(
  palette: string[],
  min: number,
  max: number,
): FeatureCollection<Polygon, SyntheticGridCell> {
  const dLon = (AOI.maxLon - AOI.minLon) / COLS;
  const dLat = (AOI.maxLat - AOI.minLat) / ROWS;

  const features: Feature<Polygon, SyntheticGridCell>[] = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const lon0 = AOI.minLon + col * dLon;
      const lat0 = AOI.minLat + row * dLat;
      const lon1 = lon0 + dLon;
      const lat1 = lat0 + dLat;
      const centerLon = (lon0 + lon1) / 2;
      const centerLat = (lat0 + lat1) / 2;

      const velocity = computeVelocity(centerLon, centerLat);
      if (velocity === null) continue; // masked → omit cell (transparent gap)

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [lon0, lat0],
            [lon1, lat0],
            [lon1, lat1],
            [lon0, lat1],
            [lon0, lat0],
          ]],
        },
        properties: {
          velocity,
          color: velocityToColor(velocity, palette, min, max),
        },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}


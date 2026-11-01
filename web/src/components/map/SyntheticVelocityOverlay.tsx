/**
 * SyntheticVelocityOverlay.tsx
 *
 * Renders the synthetic LOS velocity field as a smooth raster image over the
 * Delhi NCR AOI using MapLibre's `image` source type.  A 200×130 pixel canvas
 * is drawn once (memoised) and converted to a PNG data URL; MapLibre then
 * applies bilinear resampling so the result is smooth with no cell borders.
 *
 * Design:
 *  - Diverging palette centred at 0 mm/yr from the /layers API response.
 *  - Values within ±ALPHA_NEAR_ZERO_MM of 0 are fully transparent so the
 *    basemap shows through where motion is negligible.
 *  - Opacity ramps linearly to full between ALPHA_NEAR_ZERO_MM and ALPHA_FULL_MM.
 *  - All edges fade to 0 over EDGE_FADE_PX pixels (no hard rectangle border).
 *  - The river-corridor mask (77.24–77.28 lon, 28.62–28.66 lat) stays transparent.
 *  - When the real API delivers a tile_url containing '{z}', this component
 *    renders nothing and MapContainer switches to the TiTiler raster source.
 *
 * Boundaries: lives inside web/src/components/map/ — Sohan's zone only.
 * No science is computed here — values are synthetic fixtures for demo use.
 */

import React, { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { LayerDefinition } from '../../api/types';

// ── AOI and canvas constants ──────────────────────────────────────────────────

const AOI_MIN_LON = 76.95;
const AOI_MAX_LON = 77.40;
const AOI_MIN_LAT = 28.30;
const AOI_MAX_LAT = 28.65;

// 200×130 px → each pixel ≈ 225 m × 269 m (finer than the old 70×46 polygon grid)
const IMG_W = 200;
const IMG_H = 130;

// Transparency thresholds in mm/yr
const ALPHA_NEAR_ZERO_MM = 2.5;   // below this absolute velocity → α = 0
const ALPHA_FULL_MM      = 8.0;   // at or above this absolute velocity → α = 1

// Feathering in pixels (fade to 0 at all four borders)
const EDGE_FADE_PX = 20;

// ── Subsidence model (matches mock handlers.ts geometry) ─────────────────────

interface Bowl {
  lon: number; lat: number;
  peak: number;   // mm/yr
  r: number;      // degrees radius
}

const BOWLS: Bowl[] = [
  { lon: 77.08,  lat: 28.53,  peak: -88.4, r: 0.048 }, // Kapashera
  { lon: 77.037, lat: 28.587, peak: -48.1, r: 0.038 }, // Dwarka
  { lon: 77.31,  lat: 28.40,  peak: -39.0, r: 0.040 }, // Faridabad
];

const UPLIFTS: Bowl[] = [
  { lon: 77.20, lat: 28.60, peak: 4.5, r: 0.025 }, // Connaught Place / ref point
  { lon: 77.36, lat: 28.55, peak: 3.0, r: 0.018 }, // NOIDA border
];

function computeVelocity(lon: number, lat: number): number {
  let v = -1.5; // regional background settlement
  for (const b of BOWLS) {
    const d = Math.hypot(lon - b.lon, lat - b.lat);
    if (d < b.r) { const f = 1 - d / b.r; v += b.peak * f * f; }
  }
  for (const u of UPLIFTS) {
    const d = Math.hypot(lon - u.lon, lat - u.lat);
    if (d < u.r) { const f = 1 - d / u.r; v += u.peak * f * f; }
  }
  return v;
}

function isMasked(lon: number, lat: number): boolean {
  return lon > 77.24 && lon < 77.28 && lat > 28.62 && lat < 28.66;
}

// ── Colour utilities ──────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Linearly interpolate across a palette array; t ∈ [0, 1]. */
function paletteRgb(palette: string[], t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const n = palette.length - 1;
  const pos = clamped * n;
  const lo = Math.min(n - 1, Math.floor(pos));
  const f = pos - lo;
  const [r1, g1, b1] = hexToRgb(palette[lo]);
  const [r2, g2, b2] = hexToRgb(palette[lo + 1]);
  return [r1 + (r2 - r1) * f, g1 + (g2 - g1) * f, b1 + (b2 - b1) * f];
}

// ── Canvas builder (runs synchronously, result is memoised) ──────────────────

function buildDataUrl(palette: string[], min: number, max: number): string {
  const canvas = document.createElement('canvas');
  canvas.width  = IMG_W;
  canvas.height = IMG_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const img = ctx.createImageData(IMG_W, IMG_H);
  const d   = img.data;

  const range = max - min || 1;

  for (let py = 0; py < IMG_H; py++) {
    for (let px = 0; px < IMG_W; px++) {
      const idx = (py * IMG_W + px) * 4;

      // Pixel centre in geographic coordinates
      // Longitude increases left→right; latitude decreases top→bottom
      const lon = AOI_MIN_LON + (px + 0.5) / IMG_W * (AOI_MAX_LON - AOI_MIN_LON);
      const lat = AOI_MAX_LAT - (py + 0.5) / IMG_H * (AOI_MAX_LAT - AOI_MIN_LAT);

      // Masked zone → transparent
      if (isMasked(lon, lat)) { d[idx + 3] = 0; continue; }

      const v    = computeVelocity(lon, lat);
      const absV = Math.abs(v);

      // Alpha ramp: transparent near 0, full above threshold
      let alpha =
        absV < ALPHA_NEAR_ZERO_MM ? 0
        : absV < ALPHA_FULL_MM
          ? (absV - ALPHA_NEAR_ZERO_MM) / (ALPHA_FULL_MM - ALPHA_NEAR_ZERO_MM)
          : 1.0;

      // Edge feathering — fade all four borders
      const edgeDist = Math.min(px, IMG_W - 1 - px, py, IMG_H - 1 - py);
      if (edgeDist < EDGE_FADE_PX) alpha *= edgeDist / EDGE_FADE_PX;

      if (alpha <= 0) { d[idx + 3] = 0; continue; }

      // Palette position: diverging, 0 maps to (0 - min) / range
      const t = (v - min) / range;
      const [r, g, b] = paletteRgb(palette, t);

      d[idx]     = Math.round(r);
      d[idx + 1] = Math.round(g);
      d[idx + 2] = Math.round(b);
      d[idx + 3] = Math.round(alpha * 255);
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

// ── Image source coordinates: [topLeft, topRight, bottomRight, bottomLeft] ────

const IMAGE_COORDS: [[number,number],[number,number],[number,number],[number,number]] = [
  [AOI_MIN_LON, AOI_MAX_LAT],
  [AOI_MAX_LON, AOI_MAX_LAT],
  [AOI_MAX_LON, AOI_MIN_LAT],
  [AOI_MIN_LON, AOI_MIN_LAT],
];

function isRealTileUrl(url: string | undefined | null): boolean {
  return Boolean(url && url.includes('{z}'));
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SyntheticVelocityOverlayProps {
  layerDef: LayerDefinition | undefined;
  isActive: boolean;
  opacity: number;
}

export const SyntheticVelocityOverlay: React.FC<SyntheticVelocityOverlayProps> = ({
  layerDef,
  isActive,
  opacity,
}) => {
  const palette  = layerDef?.legend?.palette;
  const min      = layerDef?.legend?.min ?? -30;
  const max      = layerDef?.legend?.max ?? 10;
  const tileUrl  = layerDef?.tile_url;
  // Stable cache key — avoids rebuilding when only the array reference changes
  const paletteKey = palette ? palette.join(',') : '';

  const dataUrl = useMemo<string | null>(() => {
    if (!isActive || !palette || palette.length === 0) return null;
    if (isRealTileUrl(tileUrl)) return null; // real TiTiler URL available → defer to MapContainer
    return buildDataUrl(palette, min, max);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, paletteKey, min, max, tileUrl]);

  if (!dataUrl) return null;

  return (
    <Source
      id="synthetic-velocity-source"
      type="image"
      url={dataUrl}
      coordinates={IMAGE_COORDS}
    >
      <Layer
        id="synthetic-velocity-raster"
        type="raster"
        paint={{
          'raster-opacity': opacity,
          // bilinear resampling: smooth gradient, no pixelated cell boundaries
          'raster-resampling': 'linear',
        }}
      />
    </Source>
  );
};

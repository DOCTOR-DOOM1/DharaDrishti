import { http, HttpResponse } from 'msw';
import type {
  CitySummary,
  LayerDefinition,
  CityDetailSummary,
  HotspotsGeoJSON,
  TimeSeriesResponse,
  AreaStatsResponse,
  SearchResult,
  SnapshotItem,
} from '../api/types';

// Pin handlers to the mock API origin only.
// This prevents MSW from intercepting tiles.openfreemap.org, CDN requests,
// or any other third-party host. All unmatched requests go through to
// the network (onUnhandledFrame: 'bypass' in browser.ts).
const API = 'http://localhost:8000';

export const mockCities: CitySummary[] = [
  {
    slug: 'delhi-ncr',
    name: 'Delhi NCR',
    bbox: [76.95, 28.30, 77.40, 28.65],
    status: 'live',
    data_span: {
      start: '2020-01-05',
      end: '2023-12-28',
    },
    latest_update: '2026-11-01',
    sensors: ['Sentinel-1'],
    active_version: 1,
    synthetic: true,
  },
];

export const mockLayers: LayerDefinition[] = [
  {
    id: 'velocity',
    label: 'Velocity (mm/yr)',
    group: 'measured',
    file: 'velocity.tif',
    // No tile_url yet — TiTiler is not available pre-Sync 1.
    // When the real API delivers a URL containing {z}/{x}/{y}, the
    // SyntheticVelocityOverlay auto-detects and switches to raster tiles.
    legend: {
      unit: 'mm/yr',
      min: -30,
      max: 10,
      palette: [
        '#d73027',
        '#f46d43',
        '#fdae61',
        '#fee08b',
        '#ffffbf',
        '#d9ef8b',
        '#a6d96a',
        '#66bd63',
        '#1a9850',
      ],
      note: 'Line-of-sight velocity relative to reference point; positive = toward satellite. Negative values indicate ground motion away from satellite (typically subsidence).',
    },
    provenance: 'MintPy SBAS inversion of Sentinel-1 burst interferograms',
    default_on: true,
  },
  {
    id: 'velocity_sigma',
    label: 'Velocity Uncertainty (mm/yr)',
    group: 'measured',
    file: 'velocity_sigma.tif',
    legend: {
      unit: 'mm/yr',
      min: 0,
      max: 5,
      palette: ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84'],
      note: 'Standard error of the velocity estimate.',
    },
    default_on: false,
  },
  {
    id: 'coherence',
    label: 'Temporal Coherence',
    group: 'measured',
    file: 'coherence.tif',
    legend: {
      unit: '',
      min: 0,
      max: 1,
      palette: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32'],
      note: 'Temporal coherence (0–1). Pixels below 0.3 are masked.',
    },
    default_on: false,
  },
  {
    id: 'seasonal_amplitude',
    label: 'Seasonal Amplitude (mm)',
    group: 'measured',
    file: 'seasonal_amp.tif',
    legend: {
      unit: 'mm',
      min: 0,
      max: 15,
      palette: ['#fff7ec', '#fee8c8', '#fdd49e', '#fdbb84', '#fc8d59', '#ef6548', '#d7301f', '#990000'],
      note: 'Peak-to-trough seasonal displacement amplitude.',
    },
    default_on: false,
  },
  {
    id: 'gradient',
    label: 'Velocity Gradient (mm/yr per km)',
    group: 'derived',
    file: 'gradient.tif',
    legend: {
      unit: 'mm/yr per km',
      min: 0,
      max: 10,
      palette: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#99000d'],
      note: 'Spatial gradient of the velocity field. High values indicate differential motion.',
    },
    default_on: false,
  },
  {
    id: 'detection_confidence',
    label: 'Detection Confidence',
    group: 'derived',
    file: 'detection_conf.tif',
    legend: {
      unit: '',
      min: 0,
      max: 10,
      palette: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594'],
      note: '|velocity| / sigma. Values above the significance multiple (default 3) indicate statistically significant motion.',
    },
    default_on: false,
  },
  {
    id: 'risk_index',
    label: 'Risk Screening Index',
    group: 'risk',
    file: 'risk_zones.geojson',
    legend: {
      unit: '',
      min: 0,
      max: 1,
      palette: ['#fef0d9', '#fdd49e', '#fdbb84', '#fc8d59', '#e34a33', '#b30000'],
      note: 'Screening index, not a prediction of damage. Combines velocity, gradient, and building density with stated weights (see methodology). Off by default.',
    },
    provenance: 'Heuristic index — see docs/methodology.md for weights and inputs.',
    default_on: false,
  },
];

export const mockSummary: CityDetailSummary = {
  city: 'delhi-ncr',
  version: 1,
  synthetic: true,
  sensor: 'Sentinel-1',
  track: '026',
  direction: 'ascending',
  looks: '10x2',
  data_span: {
    start: '2020-01-05',
    end: '2023-12-28',
  },
  n_interferograms: {
    ordered: 42,
    accepted: 38,
    rejected: 4,
  },
  reference_point: {
    lon: 77.218,
    lat: 28.614,
    mode: 'auto',
  },
  atmosphere: 'era5',
  processor: 'hyp3-isce2 0.8.2',
  mintpy: '1.5.3',
  share_significant_motion: 0.142,
  fastest_rate: {
    value: -88.4,
    sigma: 3.2,
  },
  hotspot_area_km2: 47.6,
  coverage_pct: 82.5,
  noise_floor_mm_yr: 1.8,
  significance_multiple: 3,
};

export const mockHotspots: HotspotsGeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'hotspot-kapashera',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.065, 28.515],
            [77.095, 28.515],
            [77.095, 28.540],
            [77.065, 28.540],
            [77.065, 28.515],
          ],
        ],
      },
      properties: {
        id: 'hs-1',
        name: 'Kapashera subsidence bowl',
        mean_rate: -64.2,
        max_rate: -88.4,
        rate_sigma: 3.2,
        area_km2: 12.4,
        snr: 20.1,
      },
    },
    {
      type: 'Feature',
      id: 'hotspot-dwarka',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.020, 28.570],
            [77.055, 28.570],
            [77.055, 28.605],
            [77.020, 28.605],
            [77.020, 28.570],
          ],
        ],
      },
      properties: {
        id: 'hs-2',
        name: 'Dwarka Sector 8/9 cluster',
        mean_rate: -35.6,
        max_rate: -48.1,
        rate_sigma: 2.8,
        area_km2: 16.8,
        snr: 12.7,
      },
    },
    {
      type: 'Feature',
      id: 'hotspot-faridabad',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.290, 28.380],
            [77.330, 28.380],
            [77.330, 28.420],
            [77.290, 28.420],
            [77.290, 28.380],
          ],
        ],
      },
      properties: {
        id: 'hs-3',
        name: 'Faridabad Industrial Sector',
        mean_rate: -28.4,
        max_rate: -39.0,
        rate_sigma: 2.1,
        area_km2: 18.4,
        snr: 13.5,
      },
    },
  ],
};

export const mockSnapshots: SnapshotItem[] = [
  { epoch: '2020-01-05', tile_url: '' },
  { epoch: '2020-06-12', tile_url: '' },
  { epoch: '2020-12-28', tile_url: '' },
  { epoch: '2021-06-15', tile_url: '' },
  { epoch: '2021-12-30', tile_url: '' },
  { epoch: '2022-06-18', tile_url: '' },
  { epoch: '2022-12-25', tile_url: '' },
  { epoch: '2023-06-20', tile_url: '' },
  { epoch: '2023-12-28', tile_url: '' },
];

const reportJobs = new Map<string, { status: 'queued' | 'running' | 'done'; created: number }>();

function generateTimeSeries(lon: number, lat: number): TimeSeriesResponse {
  // Check if near Kapashera (around 77.08, 28.53)
  const distKapashera = Math.hypot(lon - 77.08, lat - 28.53);
  let velocityRate = -1.2; // default background
  let sigmaRate = 1.1;

  if (distKapashera < 0.04) {
    velocityRate = -68.5 * (1 - distKapashera / 0.04) - 2.0;
    sigmaRate = 3.2;
  } else if (Math.hypot(lon - 77.037, lat - 28.587) < 0.03) {
    // Dwarka
    velocityRate = -38.2;
    sigmaRate = 2.4;
  }

  const series: { date: string; value: number; sigma: number }[] = [];
  const startDate = new Date('2020-01-05');
  const seasonalAmp = 6.8;

  for (let i = 0; i < 36; i++) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + i);
    const tYears = i / 12;
    // trend + annual cycle + minor noise
    const trend = velocityRate * tYears;
    const season = seasonalAmp * Math.sin(2 * Math.PI * tYears);
    const noise = Math.sin(i * 1.7) * 1.2;
    const value = Math.round((trend + season + noise) * 10) / 10;
    series.push({
      date: d.toISOString().slice(0, 10),
      value,
      sigma: Math.round((sigmaRate + Math.sin(i) * 0.3) * 10) / 10,
    });
  }

  return {
    city: 'delhi-ncr',
    measured: true,
    synthetic: true,
    pixel: {
      lon: Math.round(lon * 1000) / 1000,
      lat: Math.round(lat * 1000) / 1000,
      coherence: distKapashera < 0.04 ? 0.78 : 0.65,
    },
    unit: 'mm',
    convention: 'positive = toward satellite, line-of-sight, relative to reference point',
    series,
    velocity: {
      value: Math.round(velocityRate * 10) / 10,
      sigma: Math.round(sigmaRate * 10) / 10,
      unit: 'mm/yr',
    },
    seasonal_amplitude_mm: seasonalAmp,
    provenance: {
      sensor: 'Sentinel-1',
      track: '026',
      looks: '10x2',
      mintpy: '1.5.3',
      product_version: 'v1',
    },
  };
}

export const handlers = [
  // Health check
  http.get(`${API}/health`, () => {
    return HttpResponse.json({ status: 'ok' });
  }),

  // Cities list
  http.get(`${API}/cities`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    if (status && status !== 'live') {
      return HttpResponse.json([]);
    }
    return HttpResponse.json(mockCities);
  }),

  // City summary (must come before the slug-only route)
  http.get(`${API}/cities/:slug/summary`, () => {
    return HttpResponse.json(mockSummary);
  }),

  // City layers
  http.get(`${API}/cities/:slug/layers`, () => {
    return HttpResponse.json(mockLayers);
  }),

  // City hotspots
  http.get(`${API}/cities/:slug/hotspots`, () => {
    return HttpResponse.json(mockHotspots);
  }),

  // City snapshots (epochs for timeline slider)
  http.get(`${API}/cities/:slug/snapshots`, () => {
    return HttpResponse.json(mockSnapshots);
  }),

  // City details (slug only — after more specific routes above)
  http.get(`${API}/cities/:slug`, ({ params }) => {
    const { slug } = params;
    if (slug !== 'delhi-ncr') {
      return HttpResponse.json({ error: 'City not found' }, { status: 404 });
    }
    return HttpResponse.json(mockSummary);
  }),

  // Summary fallback
  http.get(`${API}/summary`, () => {
    return HttpResponse.json(mockSummary);
  }),

  // Timeseries: 404 for masked/out-of-AOI coordinates
  http.get(`${API}/timeseries`, ({ request }) => {
    const url = new URL(request.url);
    const lonStr = url.searchParams.get('lon');
    const latStr = url.searchParams.get('lat');

    if (!lonStr || !latStr) {
      return HttpResponse.json({ error: 'Missing coordinates' }, { status: 400 });
    }

    const lon = parseFloat(lonStr);
    const lat = parseFloat(latStr);

    // Simulated masked area (river corridor / water body / out of AOI)
    if (
      lon < 76.95 ||
      lon > 77.40 ||
      lat < 28.30 ||
      lat > 28.65 ||
      (lon > 77.24 && lon < 77.28 && lat > 28.62 && lat < 28.66)
    ) {
      return HttpResponse.json({ error: 'no_reliable_measurement' }, { status: 404 });
    }

    return HttpResponse.json(generateTimeSeries(lon, lat));
  }),

  // Areas stats
  http.post(`${API}/areas/stats`, async () => {
    const res: AreaStatsResponse = {
      city: 'delhi-ncr',
      area_km2: 4.8,
      rate: -42.5,
      sigma: 2.8,
      valid_pixels: 420,
      mean_series: generateTimeSeries(77.08, 28.53).series,
    };
    return HttpResponse.json(res);
  }),

  // Search
  http.get(`${API}/search`, ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const places: SearchResult[] = [
      { name: 'Kapashera, New Delhi', type: 'place', center: [77.08, 28.53] },
      { name: 'Dwarka Sector 9, New Delhi', type: 'place', center: [77.04, 28.58] },
      { name: 'IGI Airport Terminal 3', type: 'place', center: [77.10, 28.55] },
      { name: 'Faridabad Industrial Area', type: 'place', center: [77.31, 28.40] },
      { name: 'Connaught Place (Reference Point)', type: 'place', center: [77.218, 28.614] },
    ];
    return HttpResponse.json(places.filter((p) => p.name.toLowerCase().includes(q)));
  }),

  // Downloads: redirect or mock file data
  http.get(`${API}/downloads/:slug/:kind`, ({ params }) => {
    const slug = String(params.slug || 'delhi-ncr');
    const kind = String(params.kind || '');
    if (kind === 'timeseries_csv') {
      const csv =
        'date,displacement_mm,sigma_mm\n2020-01-05,0.0,1.1\n2020-06-12,-12.4,1.8\n2021-01-15,-28.5,2.1\n2022-01-10,-45.2,2.6\n2023-01-12,-62.8,3.1\n';
      return new HttpResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${slug}_timeseries.csv"`,
        },
      });
    }
    return HttpResponse.json({
      city: slug,
      kind,
      download_url: `http://localhost:8000/data/${slug}/${kind}`,
      size_mb: kind.includes('cog') ? 4.2 : 0.8,
    });
  }),

  // Report creation
  http.post(`${API}/reports`, async () => {
    const id = `rep-${Date.now()}`;
    reportJobs.set(id, { status: 'running', created: Date.now() });
    return HttpResponse.json({
      id,
      status: 'running',
      created_at: new Date().toISOString(),
    });
  }),

  // Report status & PDF fetch
  http.get(`${API}/reports/:id`, ({ params }) => {
    const { id } = params;
    const job = reportJobs.get(String(id));
    const elapsed = Date.now() - (job?.created ?? Date.now());
    const isDone = elapsed > 2000;
    return HttpResponse.json({
      id,
      status: isDone ? 'done' : 'running',
      download_url: isDone ? `http://localhost:8000/reports/${id}/subsidence_report.pdf` : undefined,
    });
  }),
];


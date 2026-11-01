import type {
  CitySummary,
  CityDetailSummary,
  LayerDefinition,
  HotspotsGeoJSON,
  TimeSeriesResponse,
  AreaStatsResponse,
  SearchResult,
  SnapshotItem,
  ReportJobResponse,
} from './types';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let errData: unknown;
    try {
      errData = await res.json();
    } catch {
      errData = null;
    }
    throw new ApiError(`Request failed with status ${res.status}`, res.status, errData);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getCities: async (status: string = 'live'): Promise<CitySummary[]> => {
    return fetchJson<CitySummary[]>(`${API_BASE_URL}/cities?status=${status}`);
  },

  getCitySummary: async (slug: string): Promise<CityDetailSummary> => {
    try {
      return await fetchJson<CityDetailSummary>(`${API_BASE_URL}/cities/${slug}/summary`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        return await fetchJson<CityDetailSummary>(`${API_BASE_URL}/summary?city=${slug}`);
      }
      throw e;
    }
  },

  getLayers: async (slug: string): Promise<LayerDefinition[]> => {
    return fetchJson<LayerDefinition[]>(`${API_BASE_URL}/cities/${slug}/layers`);
  },

  getHotspots: async (
    slug: string,
    params?: { min_rate?: number; min_snr?: number; bbox?: string }
  ): Promise<HotspotsGeoJSON> => {
    const q = new URLSearchParams();
    if (params?.min_rate) q.set('min_rate', String(params.min_rate));
    if (params?.min_snr) q.set('min_snr', String(params.min_snr));
    if (params?.bbox) q.set('bbox', params.bbox);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<HotspotsGeoJSON>(`${API_BASE_URL}/cities/${slug}/hotspots${qs}`);
  },

  getTimeSeries: async (city: string, lon: number, lat: number): Promise<TimeSeriesResponse> => {
    return fetchJson<TimeSeriesResponse>(
      `${API_BASE_URL}/timeseries?city=${encodeURIComponent(city)}&lon=${lon}&lat=${lat}`
    );
  },

  getAreaStats: async (city: string, polygon: GeoJSON.Feature): Promise<AreaStatsResponse> => {
    return fetchJson<AreaStatsResponse>(`${API_BASE_URL}/areas/stats?city=${encodeURIComponent(city)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(polygon),
    });
  },

  searchPlaces: async (q: string): Promise<SearchResult[]> => {
    return fetchJson<SearchResult[]>(`${API_BASE_URL}/search?q=${encodeURIComponent(q)}`);
  },

  getSnapshots: async (slug: string): Promise<SnapshotItem[]> => {
    return fetchJson<SnapshotItem[]>(`${API_BASE_URL}/cities/${slug}/snapshots`);
  },

  getDownloadUrl: (slug: string, kind: string): string => {
    return `${API_BASE_URL}/downloads/${encodeURIComponent(slug)}/${encodeURIComponent(kind)}`;
  },

  createReport: async (city: string): Promise<ReportJobResponse> => {
    return fetchJson<ReportJobResponse>(`${API_BASE_URL}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city }),
    });
  },

  getReportStatus: async (id: string): Promise<ReportJobResponse> => {
    return fetchJson<ReportJobResponse>(`${API_BASE_URL}/reports/${id}`);
  },
};


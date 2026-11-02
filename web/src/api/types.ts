import type { Feature, FeatureCollection, Geometry } from 'geojson';

export interface CitySummary {
  slug: string;
  name: string;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  status: string;
  data_span: {
    start: string;
    end: string;
  };
  latest_update: string;
  sensors: string[];
  active_version: number;
  synthetic: boolean;
}

export interface LayerLegend {
  unit: string;
  min: number;
  max: number;
  palette: string[];
  note?: string;
}

export type LayerGroup = 'measured' | 'derived' | 'risk';

export interface LayerDefinition {
  id: string;
  label: string;
  group: LayerGroup;
  tile_url?: string;
  file?: string;
  legend: LayerLegend;
  provenance?: string;
  default_on: boolean;
}

export interface CityMeta {
  city: string;
  version: number;
  synthetic: boolean;
  sensor: string;
  track: string;
  direction: 'ascending' | 'descending' | string;
  looks: string;
  data_span: {
    start: string;
    end: string;
  };
  n_interferograms: {
    ordered: number;
    accepted: number;
    rejected: number;
  };
  reference_point: {
    lon: number;
    lat: number;
    mode: string;
  };
  atmosphere: string;
  processor: string;
  mintpy: string;
}

export interface CityScienceSummary {
  share_significant_motion: number;
  fastest_rate: {
    value: number;
    sigma: number;
  };
  hotspot_area_km2: number;
  coverage_pct: number;
  noise_floor_mm_yr: number | null;
  significance_multiple: number;
}

export type CityDetailSummary = CityMeta & CityScienceSummary;

export interface TimeSeriesPoint {
  date: string;
  value: number; // displacement in mm
  sigma: number; // uncertainty in mm
}

export interface TimeSeriesResponse {
  city: string;
  measured: boolean;
  synthetic: boolean;
  pixel: {
    lon: number;
    lat: number;
    coherence: number;
  };
  unit: string;
  convention: string;
  series: TimeSeriesPoint[];
  velocity: {
    value: number;
    sigma: number;
    unit: string;
  };
  seasonal_amplitude_mm: number;
  provenance: {
    sensor: string;
    track: string;
    looks: string;
    mintpy: string;
    product_version: string;
  };
}

export interface AreaStatsRequest {
  polygon: Feature<Geometry>;
}

export interface AreaStatsResponse {
  city: string;
  area_km2: number;
  rate: number;
  sigma: number;
  valid_pixels: number;
  mean_series: TimeSeriesPoint[];
}

export interface HotspotProperties {
  id: string | number;
  mean_rate: number; // mm/yr LOS
  max_rate: number;
  rate_sigma: number;
  area_km2: number;
  snr: number;
  [key: string]: unknown;
}

export type HotspotsGeoJSON = FeatureCollection<Geometry, HotspotProperties>;

export interface RiskZoneProperties {
  kind: 'risk_heuristic';
  risk_index: number;
  inputs: {
    velocity: number;
    gradient: number;
    building_density: number;
  };
  weights_version: string;
  [key: string]: unknown;
}

export type RiskZonesGeoJSON = FeatureCollection<Geometry, RiskZoneProperties>;

export interface SnapshotItem {
  epoch: string;
  tile_url: string;
}

export interface ReportJobResponse {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  download_url?: string;
  created_at?: string;
  error?: string;
}

export interface DownloadOption {
  kind: string;
  label: string;
  format: string;
  description: string;
}

export interface SearchResult {
  name: string;
  type: 'city' | 'place';
  bbox?: [number, number, number, number];
  center: [number, number];
}

// Section 3.11 View-Mount Interface
export interface ViewProps {
  apiUrl: string;
  city: string;
  version: number;
  selectedFeature: Feature | null;
  flyTo(bbox: [number, number, number, number]): void;
  selectFeature(f: Feature | null): void;
}

export interface MountedViewModule {
  id: string;
  title: string;
  group: 'measured' | 'derived' | 'risk' | 'tools';
  Component: (props: ViewProps) => React.ReactElement | null;
}


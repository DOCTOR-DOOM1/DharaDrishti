"""Pydantic response schemas — contract section 3.7."""

from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional


# ── Health ──

class HealthResponse(BaseModel):
    status: str = "ok"


# ── Cities ──

class DataSpan(BaseModel):
    start: Optional[date] = None
    end: Optional[date] = None


class CityListItem(BaseModel):
    slug: str
    name: str
    bbox: list[float]
    status: str
    data_span: Optional[DataSpan] = None
    latest_update: Optional[datetime] = None
    sensors: list[str] = []
    active_version: int = 1
    synthetic: bool = False


class CityDetail(CityListItem):
    pass


# ── Summary (merge of meta.json + summary.json) ──

class ReferencePoint(BaseModel):
    lon: float = 0.0
    lat: float = 0.0
    mode: str = "auto"


class InterferogramCounts(BaseModel):
    ordered: int = 0
    accepted: int = 0
    rejected: int = 0


class FastestRate(BaseModel):
    value: float = 0.0
    sigma: float = 0.0


class SummaryResponse(BaseModel):
    # From meta.json (Yash)
    city: str
    version: int = 1
    synthetic: bool = False
    sensor: str = "Sentinel-1"
    track: str = "TBD"
    direction: str = "ascending"
    looks: str = "10x2"
    data_span: Optional[DataSpan] = None
    n_interferograms: InterferogramCounts = InterferogramCounts()
    reference_point: ReferencePoint = ReferencePoint()
    atmosphere: str = "none"
    processor: str = ""
    mintpy: str = ""
    # From summary.json (Shivani)
    share_significant_motion: float = 0.0
    fastest_rate: FastestRate = FastestRate()
    hotspot_area_km2: float = 0.0
    coverage_pct: float = 0.0
    noise_floor_mm_yr: Optional[float] = None
    significance_multiple: int = 3


# ── Layers ──

class LayerLegend(BaseModel):
    unit: str
    min: float
    max: float
    palette: list[str]
    note: Optional[str] = None


class LayerInfo(BaseModel):
    id: str
    label: str
    group: str  # measured | derived | risk
    tile_url: str
    legend: LayerLegend
    provenance: Optional[str] = None
    default_on: bool = True


# ── Snapshots ──

class SnapshotItem(BaseModel):
    epoch: str
    tile_url: str


# ── Timeseries ──

class TimeseriesPixel(BaseModel):
    lon: float
    lat: float
    coherence: float = 0.0


class TimeseriesVelocity(BaseModel):
    value: float
    sigma: float
    unit: str = "mm/yr"


class TimeseriesProvenance(BaseModel):
    sensor: str
    track: str
    looks: str
    mintpy: str = ""
    product_version: str = "v1"


class TimeseriesPoint(BaseModel):
    date: str
    value: float
    sigma: float


class TimeseriesResponse(BaseModel):
    city: str
    measured: bool = True
    synthetic: bool = False
    pixel: TimeseriesPixel
    unit: str = "mm"
    convention: str = "positive = toward satellite, line-of-sight, relative to reference point"
    series: list[TimeseriesPoint] = []
    velocity: TimeseriesVelocity
    seasonal_amplitude_mm: float = 0.0
    provenance: TimeseriesProvenance


class NoReliableMeasurement(BaseModel):
    error: str = "no_reliable_measurement"


# ── Area Stats ──

class AreaStatsResponse(BaseModel):
    city: str
    mean_rate: float
    rate_sigma: float
    area_km2: float
    valid_pixel_count: int
    mean_series: list[TimeseriesPoint] = []


# ── Hotspot Properties ──

class HotspotProperties(BaseModel):
    id: str
    mean_rate: float  # mm/yr LOS
    max_rate: float
    rate_sigma: float
    area_km2: float
    snr: float


# ── Risk Zone Properties ──

class RiskZoneProperties(BaseModel):
    zone_id: str
    risk_index: float
    kind: str = "risk_heuristic"
    inputs: Optional[dict] = None
    weights_version: Optional[str] = None


# ── Alert Properties ──

class AlertProperties(BaseModel):
    rate_before: float
    rate_after: float
    snr: float
    created_at: datetime


# ── Reference ──

class ReferenceItem(BaseModel):
    citation: str
    url: Optional[str] = None
    area_name: str
    reported_rate: float  # mm/yr
    rate_basis: str  # "line of sight" | "vertical" | "not stated"
    period: Optional[str] = None
    method: Optional[str] = None


# ── Interferograms ──

class InterferogramItem(BaseModel):
    ref_date: str
    sec_date: str
    sensor: str
    track: str
    direction: str
    status: str  # accepted | rejected
    rejection_reason: Optional[str] = None
    mean_coherence: Optional[float] = None
    browse_url: Optional[str] = None
    hyp3_job_id: Optional[str] = None


# ── Profile ──

class ProfilePoint(BaseModel):
    distance_km: float
    velocity: float
    gradient: Optional[float] = None


class ProfileResponse(BaseModel):
    city: str
    points: list[ProfilePoint]


# ── Compare ──

class CompareCity(BaseModel):
    slug: str
    name: str
    share_significant_motion: float
    fastest_rate: FastestRate
    hotspot_area_km2: float
    data_span: Optional[DataSpan] = None
    geometry: Optional[dict] = None


class CompareResponse(BaseModel):
    cities: list[CompareCity]


# ── Search ──

class SearchResult(BaseModel):
    type: str  # "city" | "place"
    slug: Optional[str] = None
    name: str
    bbox: Optional[list[float]] = None
    center: Optional[list[float]] = None


# ── Reports ──

class ReportCreateRequest(BaseModel):
    city: str
    version: int = 1
    layers: list[str] = []
    include_risk: bool = False


class ReportResponse(BaseModel):
    id: int
    status: str
    download_url: Optional[str] = None


# ── Admin ──

class AdminCityCreate(BaseModel):
    slug: str
    name: str
    bbox: list[float]
    sensors: list[str] = ["Sentinel-1"]


class AdminJobResponse(BaseModel):
    id: int
    city_slug: str
    job_type: str
    status: str
    credits_used: float = 0.0
    error_message: Optional[str] = None
    stages: list[dict] = []
    created_at: datetime

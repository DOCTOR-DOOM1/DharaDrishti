"""SQLAlchemy ORM models — architecture section 12.4 schema.

Tables: cities, acquisitions, interferograms, products, hotspots,
risk_zones, alerts, jobs, job_stages, reports, reference_results.
All geometry columns use GiST indexes.
"""

from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Date, Text,
    ForeignKey, JSON, Enum, UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.core.database import Base
import enum


# ── Enums ──

class CityStatus(str, enum.Enum):
    live = "live"
    processing = "processing"
    planned = "planned"


class JobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    waiting_for_credits = "waiting_for_credits"
    failed = "failed"
    done = "done"


class StageStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    done = "done"
    skipped = "skipped"
    failed = "failed"


class LayerGroup(str, enum.Enum):
    measured = "measured"
    derived = "derived"
    risk = "risk"


class ReportStatus(str, enum.Enum):
    queued = "queued"
    generating = "generating"
    done = "done"
    failed = "failed"


# ── Models ──

class City(Base):
    __tablename__ = "cities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(256), nullable=False)
    bbox = Column(JSON, nullable=False)  # [west, south, east, north]
    status = Column(Enum(CityStatus), default=CityStatus.planned, nullable=False)
    data_span_start = Column(Date, nullable=True)
    data_span_end = Column(Date, nullable=True)
    sensors = Column(JSON, default=list)  # ["Sentinel-1", "NISAR"]
    active_version = Column(Integer, default=1)
    synthetic = Column(Boolean, default=False)
    geom = Column(Geometry("POLYGON", srid=4326), nullable=True)
    latest_update = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    products = relationship("Product", back_populates="city")
    hotspots = relationship("Hotspot", back_populates="city")
    risk_zones = relationship("RiskZone", back_populates="city")
    alerts = relationship("Alert", back_populates="city")
    jobs = relationship("Job", back_populates="city")
    reference_results = relationship("ReferenceResult", back_populates="city")

    __table_args__ = (
        Index("idx_cities_geom", "geom", postgresql_using="gist"),
    )


class Acquisition(Base):
    __tablename__ = "acquisitions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city_slug = Column(String(64), ForeignKey("cities.slug"), nullable=False, index=True)
    sensor = Column(String(64), nullable=False)
    track = Column(String(32), nullable=False)
    direction = Column(String(16), nullable=False)  # ascending | descending
    acquisition_date = Column(Date, nullable=False)
    granule_id = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("city_slug", "sensor", "track", "acquisition_date",
                         name="uq_acquisition"),
    )


class Interferogram(Base):
    __tablename__ = "interferograms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city_slug = Column(String(64), ForeignKey("cities.slug"), nullable=False, index=True)
    ref_date = Column(Date, nullable=False)
    sec_date = Column(Date, nullable=False)
    sensor = Column(String(64), nullable=False)
    track = Column(String(32), nullable=False)
    direction = Column(String(16), nullable=False)
    looks = Column(String(16), nullable=False)
    processor = Column(String(128), nullable=True)
    processor_version = Column(String(32), nullable=True)
    status = Column(String(16), nullable=False, default="pending")  # pending|accepted|rejected
    rejection_reason = Column(Text, nullable=True)
    mean_coherence = Column(Float, nullable=True)
    browse_url = Column(String(512), nullable=True)
    hyp3_job_id = Column(String(128), nullable=True)
    store_key = Column(String(512), nullable=True, unique=True)
    synthetic = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("city_slug", "ref_date", "sec_date", "sensor", "track", "looks",
                         name="uq_interferogram"),
    )


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False, index=True)
    city_slug = Column(String(64), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    file_type = Column(String(64), nullable=False)  # velocity.tif, hotspots.geojson, etc.
    s3_key = Column(String(512), nullable=False, unique=True)
    content_type = Column(String(128), nullable=True)
    size_bytes = Column(Integer, nullable=True)
    layer_group = Column(Enum(LayerGroup), nullable=True)
    synthetic = Column(Boolean, default=False)
    meta_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    city = relationship("City", back_populates="products")

    __table_args__ = (
        UniqueConstraint("city_slug", "version", "file_type", name="uq_product"),
    )


class Hotspot(Base):
    __tablename__ = "hotspots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False, index=True)
    city_slug = Column(String(64), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    hotspot_id = Column(String(64), nullable=False)
    mean_rate = Column(Float, nullable=False)  # mm/yr LOS
    max_rate = Column(Float, nullable=True)
    rate_sigma = Column(Float, nullable=True)
    area_km2 = Column(Float, nullable=True)
    snr = Column(Float, nullable=True)
    geom = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)
    properties = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    city = relationship("City", back_populates="hotspots")

    __table_args__ = (
        Index("idx_hotspots_geom", "geom", postgresql_using="gist"),
        UniqueConstraint("city_slug", "version", "hotspot_id", name="uq_hotspot"),
    )


class RiskZone(Base):
    __tablename__ = "risk_zones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False, index=True)
    city_slug = Column(String(64), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    zone_id = Column(String(64), nullable=False)
    risk_index = Column(Float, nullable=False)
    kind = Column(String(32), nullable=False, default="risk_heuristic")
    inputs = Column(JSON, nullable=True)
    weights_version = Column(String(16), nullable=True)
    geom = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    city = relationship("City", back_populates="risk_zones")

    __table_args__ = (
        Index("idx_risk_zones_geom", "geom", postgresql_using="gist"),
        UniqueConstraint("city_slug", "version", "zone_id", name="uq_risk_zone"),
    )


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False, index=True)
    city_slug = Column(String(64), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    rate_before = Column(Float, nullable=False)
    rate_after = Column(Float, nullable=False)
    snr = Column(Float, nullable=True)
    geom = Column(Geometry("POINT", srid=4326), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    city = relationship("City", back_populates="alerts")

    __table_args__ = (
        Index("idx_alerts_geom", "geom", postgresql_using="gist"),
    )


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False, index=True)
    city_slug = Column(String(64), nullable=False, index=True)
    job_type = Column(String(32), nullable=False)  # ingest, update, derive
    status = Column(Enum(JobStatus), default=JobStatus.queued, nullable=False)
    credits_used = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    city = relationship("City", back_populates="jobs")
    stages = relationship("JobStage", back_populates="job", order_by="JobStage.order")


class JobStage(Base):
    __tablename__ = "job_stages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    stage_name = Column(String(64), nullable=False)
    order = Column(Integer, nullable=False)
    status = Column(Enum(StageStatus), default=StageStatus.pending, nullable=False)
    result = Column(String(16), nullable=True)  # done | skipped
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    job = relationship("Job", back_populates="stages")

    __table_args__ = (
        UniqueConstraint("job_id", "stage_name", name="uq_job_stage"),
    )


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city_slug = Column(String(64), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    status = Column(Enum(ReportStatus), default=ReportStatus.queued, nullable=False)
    s3_key = Column(String(512), nullable=True)
    parameters = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class ReferenceResult(Base):
    __tablename__ = "reference_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False, index=True)
    city_slug = Column(String(64), nullable=False, index=True)
    citation = Column(Text, nullable=False)
    url = Column(String(512), nullable=True)
    area_name = Column(String(256), nullable=False)
    reported_rate = Column(Float, nullable=False)
    rate_basis = Column(String(64), nullable=False)  # "line of sight" | "vertical" | "not stated"
    period = Column(String(64), nullable=True)
    method = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    city = relationship("City", back_populates="reference_results")

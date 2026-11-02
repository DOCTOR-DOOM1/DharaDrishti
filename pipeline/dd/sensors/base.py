"""
pipeline/dd/sensors/base.py

Base classes for sensor adapters.

A SensorAdapter converts a downloaded processor output into a
StandardInterferogram — the single format the rest of the pipeline consumes.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class StandardInterferogram:
    """
    One interferogram in the canonical DharaDrishti format.

    All spatial arrays are on the city grid (EPSG:4326), float32, nodata=-9999.

    Key design decisions:
      - wavelength_m is stored per interferogram (never hard-coded) because
        NISAR and Sentinel-1 differ and may even differ by mode.
      - processor_version is required so we can key the immutable store.
      - For NISAR: maturity and release_id must be captured.
    """

    # --- Identity ---
    sensor: str                     # e.g. "Sentinel-1", "NISAR"
    track: str                      # track/frame identifier
    direction: str                  # "ascending" | "descending"
    ref_date: str                   # ISO-8601 "YYYY-MM-DD"
    sec_date: str                   # ISO-8601 "YYYY-MM-DD"
    burst_ids: list[str]            # sorted list of burst IDs (Sentinel-1)
    looks: str                      # e.g. "10x2" (range x azimuth)

    # --- Processor provenance ---
    processor: str                  # e.g. "hyp3-isce2"
    processor_version: str          # e.g. "2.9.0"
    job_id: str                     # HyP3 job UUID or similar

    # --- Physics ---
    wavelength_m: float             # metres — NEVER hard-code; read from metadata

    # --- File paths (on disk after download) ---
    unwrapped_phase_path: Path      # radians, city grid, nodata
    coherence_path: Path            # 0..1, same grid
    connected_components_path: Path # integer label, same grid
    incidence_angle_path: Path      # degrees, per-pixel
    azimuth_angle_path: Path        # degrees, per-pixel

    # --- Optional flags ---
    ionosphere_applied: bool = False  # relevant for NISAR L-band
    # NISAR-specific (None for Sentinel-1)
    nisar_maturity: Optional[str] = None    # "BETA" | "PROVISIONAL" | "VALIDATED"
    nisar_release_id: Optional[str] = None

    def immutable_key(self) -> str:
        """
        Unique, stable key for the interferogram store.
        Changing any of these fields means a new key → no re-computation.
        """
        burst_str = "_".join(sorted(self.burst_ids))
        return (
            f"{self.sensor}_{self.direction}_{self.ref_date}_{self.sec_date}"
            f"_{burst_str}_{self.looks}_{self.processor}_{self.processor_version}"
        )


class SensorAdapter(abc.ABC):
    """
    Abstract base for sensor adapters.

    Concrete subclasses:
      - Sentinel1HyP3Adapter   (sensors/sentinel1_hyp3.py)
      - NisarGunwAdapter       (sensors/nisar_gunw.py — T3)
    """

    @abc.abstractmethod
    def search(
        self,
        aoi_wkt: str,
        start_date: str,
        end_date: str,
        *,
        track: Optional[str] = None,
        direction: Optional[str] = None,
    ) -> list[dict]:
        """
        Search the sensor archive.
        Returns a list of metadata dicts (sensor-specific).
        """

    @abc.abstractmethod
    def plan_pairs(
        self,
        scenes: list[dict],
        *,
        max_temporal_days: int = 48,
        yearly: bool = True,
    ) -> list[tuple[str, str]]:
        """
        Given a list of scenes, return (ref_date, sec_date) pairs.
        Each pair spans ≤ max_temporal_days *or* ~365 days (yearly bridges).
        """

    @abc.abstractmethod
    def estimate_credits(self, pairs: list[tuple[str, str]], looks: str) -> float:
        """Return estimated HyP3 (or equivalent) credit cost for the pairs."""

    @abc.abstractmethod
    def submit(
        self,
        pairs: list[tuple[str, str]],
        aoi_wkt: str,
        looks: str,
        *,
        budget_credits: float = 1000.0,
    ) -> list[str]:
        """Submit jobs; return list of job IDs."""

    @abc.abstractmethod
    def poll(self, job_ids: list[str]) -> list[dict]:
        """Poll status of jobs; return list of job status dicts."""

    @abc.abstractmethod
    def download(self, job_id: str, dest_dir: Path) -> Path:
        """Download a completed job's output to dest_dir. Return local path."""

    @abc.abstractmethod
    def to_standard(self, local_path: Path, city_config: dict) -> StandardInterferogram:
        """Convert a downloaded product to StandardInterferogram."""


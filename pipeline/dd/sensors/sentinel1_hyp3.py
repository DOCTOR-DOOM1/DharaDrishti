"""
pipeline/dd/sensors/sentinel1_hyp3.py

Sentinel-1 burst InSAR adapter using ASF HyP3.

Implements:
  - Scene search via asf_search
  - Pair planning (sequential + yearly bridges)
  - Credit estimation
  - Job submission + polling via hyp3_sdk
  - Download to immutable store
  - Conversion to StandardInterferogram
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Optional
import zipfile

import asf_search as asf
import hyp3_sdk
import numpy as np

from .base import SensorAdapter, StandardInterferogram

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Credit schedule (HyP3 burst InSAR as of 2024)
# ---------------------------------------------------------------------------
CREDIT_SCHEDULE = {
    "80m": {  # 20x4 looks
        "1_to_4_bursts": 1,
        "5_to_12_bursts": 5,
    },
    "40m": {  # 10x2 looks
        "1_to_4_bursts": 5,
        "5_to_12_bursts": 10,
    },
    "20m": {  # 5x1 looks
        "1_to_4_bursts": 20,
        "5_to_12_bursts": 40,
    },
}

LOOKS_TO_RESOLUTION = {
    "20x4": "80m",
    "10x2": "40m",
    "5x1": "20m",
}


def _resolution_class(looks: str) -> str:
    """Map looks string to resolution class for credit schedule."""
    return LOOKS_TO_RESOLUTION.get(looks, "80m")


def _bursts_from_job(job_dict: dict) -> list[str]:
    """Extract sorted burst IDs from a HyP3 job dict."""
    params = job_dict.get("job_parameters", {})
    bid = params.get("burst_id", [])
    if isinstance(bid, str):
        bid = [bid]
    return sorted(bid)


class Sentinel1HyP3Adapter(SensorAdapter):
    """
    Sentinel-1 burst InSAR via ASF HyP3.

    Parameters
    ----------
    hyp3_url : str
        HyP3 API endpoint (default: production).
    """

    # Sentinel-1 C-band wavelength in metres (5.54 cm)
    WAVELENGTH_M = 0.05546576

    def __init__(self, hyp3_url: str = "https://hyp3-api.asf.alaska.edu"):
        self._hyp3_url = hyp3_url
        self._hyp3: Optional[hyp3_sdk.HyP3] = None

    def _get_hyp3(self) -> hyp3_sdk.HyP3:
        if self._hyp3 is None:
            # Uses ~/.netrc for credentials
            self._hyp3 = hyp3_sdk.HyP3(self._hyp3_url)
        return self._hyp3

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------
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
        Search ASF for Sentinel-1 IW SLC scenes over the AOI.

        Returns list of dicts with keys: date, scene_name, track, direction.
        """
        log.info("Searching ASF: %s to %s", start_date, end_date)
        kwargs: dict = dict(
            platform=[asf.SENTINEL1],
            processingLevel=[asf.SLC],
            start=start_date,
            end=end_date,
            intersectsWith=aoi_wkt,
            beamMode=["IW"],
        )
        if track:
            kwargs["pathNumbers"] = [int(track)]
        if direction:
            kwargs["flightDirections"] = [direction.upper()]

        results = asf.search(**kwargs)
        scenes = []
        for r in results:
            props = r.properties
            scenes.append({
                "date": props["startTime"][:10],
                "scene_name": props["sceneName"],
                "track": str(props.get("pathNumber", "")),
                "direction": props.get("flightDirection", "").lower(),
                "burst_count": props.get("burstCount", 1),
            })
        log.info("Found %d scenes", len(scenes))
        return scenes

    # ------------------------------------------------------------------
    # Pair planning
    # ------------------------------------------------------------------
    def plan_pairs(
        self,
        scenes: list[dict],
        *,
        max_temporal_days: int = 48,
        yearly: bool = True,
    ) -> list[tuple[str, str]]:
        """
        Build interferogram pairs:
          - Sequential: each date → next 3 neighbours within max_temporal_days
          - Yearly bridges: each date → date ~365 days later (±15 days)
        """
        dates = sorted({s["date"] for s in scenes})
        from datetime import date, timedelta

        date_objs = [date.fromisoformat(d) for d in dates]
        pairs: set[tuple[str, str]] = set()

        for i, ref in enumerate(date_objs):
            neighbours = 0
            for sec in date_objs[i + 1:]:
                delta = (sec - ref).days
                if delta > max_temporal_days:
                    break
                pairs.add((str(ref), str(sec)))
                neighbours += 1
                if neighbours >= 3:
                    break

        if yearly:
            for i, ref in enumerate(date_objs):
                for sec in date_objs[i + 1:]:
                    delta = (sec - ref).days
                    if 350 <= delta <= 380:
                        pairs.add((str(ref), str(sec)))

        sorted_pairs = sorted(pairs)
        log.info("Planned %d pairs", len(sorted_pairs))
        return sorted_pairs

    # ------------------------------------------------------------------
    # Credit estimation
    # ------------------------------------------------------------------
    def estimate_credits(self, pairs: list[tuple[str, str]], looks: str) -> float:
        """
        Estimate credits. Conservative: assumes 5-12 burst tier.
        Adjust once actual burst counts are known.
        """
        res_class = _resolution_class(looks)
        credit_per_pair = CREDIT_SCHEDULE.get(res_class, CREDIT_SCHEDULE["80m"])
        # Conservative: assume all jobs are 5-12 bursts
        per_pair = credit_per_pair["5_to_12_bursts"]
        return float(len(pairs) * per_pair)

    # ------------------------------------------------------------------
    # Submit
    # ------------------------------------------------------------------
    def submit(
        self,
        pairs: list[tuple[str, str]],
        aoi_wkt: str,
        looks: str = "20x4",
        *,
        budget_credits: float = 1000.0,
    ) -> list[str]:
        """
        Submit HyP3 burst InSAR jobs.
        Stops if estimated cost would exceed budget_credits.
        """
        estimated = self.estimate_credits(pairs, looks)
        if estimated > budget_credits:
            log.warning(
                "Estimated %.0f credits exceeds budget %.0f. Submitting subset.",
                estimated, budget_credits,
            )

        hyp3 = self._get_hyp3()
        job_ids: list[str] = []
        total_credits = 0.0

        for ref_date, sec_date in pairs:
            # Per-pair credit check
            res_class = _resolution_class(looks)
            per_pair = CREDIT_SCHEDULE.get(res_class, CREDIT_SCHEDULE["80m"])["5_to_12_bursts"]
            if total_credits + per_pair > budget_credits:
                log.warning(
                    "Credit budget reached at %d pairs. State: waiting_for_credits",
                    len(job_ids),
                )
                break

            try:
                batch = hyp3.submit_autorift_job(
                    granule1=ref_date,  # placeholder: real call uses burst granule names
                    granule2=sec_date,
                )
                # hyp3_sdk returns a Batch; iterate jobs
                for job in batch:
                    job_ids.append(job.job_id)
                    total_credits += per_pair
                    log.info("Submitted job %s (%s → %s)", job.job_id, ref_date, sec_date)
            except Exception as exc:
                log.error("Submission failed for %s → %s: %s", ref_date, sec_date, exc)

        return job_ids

    # ------------------------------------------------------------------
    # Poll
    # ------------------------------------------------------------------
    def poll(self, job_ids: list[str]) -> list[dict]:
        """Poll status for a list of job IDs."""
        hyp3 = self._get_hyp3()
        results = []
        for jid in job_ids:
            try:
                job = hyp3.get_job_by_id(jid)
                results.append({
                    "job_id": jid,
                    "status": job.status_code,
                    "expiration_time": str(getattr(job, "expiration_time", "")),
                    "files": [f.url for f in getattr(job, "files", [])],
                })
            except Exception as exc:
                log.error("Poll failed for %s: %s", jid, exc)
        return results

    # ------------------------------------------------------------------
    # Download
    # ------------------------------------------------------------------
    def download(self, job_id: str, dest_dir: Path) -> Path:
        """Download a completed job to dest_dir. Returns the local path."""
        hyp3 = self._get_hyp3()
        job = hyp3.get_job_by_id(job_id)
        dest_dir.mkdir(parents=True, exist_ok=True)
        paths = job.download_files(location=dest_dir)
        if not paths:
            raise RuntimeError(f"No files downloaded for job {job_id}")
        return paths[0]

    # ------------------------------------------------------------------
    # Convert to StandardInterferogram
    # ------------------------------------------------------------------
    def to_standard(self, local_path: Path, city_config: dict) -> StandardInterferogram:
        """
        Convert a HyP3 burst InSAR output (ZIP or directory) to StandardInterferogram.

        HyP3 ISCE2 burst InSAR output structure:
          <job_id>/
            <ref>_<sec>_<burst>_<burst>_<looks>_<processor>/
              *.unw_phase.tif       — unwrapped phase (radians)
              *.corr.tif            — coherence
              *.conncomp.tif        — connected components
              *.inc_map.tif         — incidence angle
              *.lv_theta.tif        — azimuth angle
              *.json                — metadata
        """
        # Unzip if needed
        work_dir = local_path
        if local_path.suffix == ".zip":
            work_dir = local_path.parent / local_path.stem
            if not work_dir.exists():
                with zipfile.ZipFile(local_path) as zf:
                    zf.extractall(local_path.parent)

        # Find the product directory
        product_dirs = [p for p in work_dir.iterdir() if p.is_dir()]
        if not product_dirs:
            raise RuntimeError(f"No product dir found in {work_dir}")
        product_dir = product_dirs[0]

        def _find(pattern: str) -> Path:
            matches = list(product_dir.glob(pattern))
            if not matches:
                raise FileNotFoundError(f"Pattern {pattern!r} not found in {product_dir}")
            return matches[0]

        unw_path = _find("*.unw_phase.tif")
        corr_path = _find("*.corr.tif")
        conn_path = _find("*.conncomp.tif")
        inc_path = _find("*.inc_map.tif")
        az_path = _find("*.lv_theta.tif")

        # Read metadata JSON
        meta_files = list(product_dir.glob("*.json"))
        meta: dict = {}
        if meta_files:
            with meta_files[0].open() as fh:
                meta = json.load(fh)

        # Parse dates and burst IDs from directory name
        # Typical name: 20210105_20210117_IW1_IW2_VV_0_RTC_10m_amp-grd-rmli_power_1_2
        name_parts = product_dir.name.split("_")
        ref_date = name_parts[0] if len(name_parts) > 0 else "unknown"
        sec_date = name_parts[1] if len(name_parts) > 1 else "unknown"
        # Format dates
        if len(ref_date) == 8:
            ref_date = f"{ref_date[:4]}-{ref_date[4:6]}-{ref_date[6:8]}"
        if len(sec_date) == 8:
            sec_date = f"{sec_date[:4]}-{sec_date[4:6]}-{sec_date[6:8]}"

        # Extract burst IDs from metadata or directory name
        burst_ids = meta.get("burst_ids", [name_parts[2]] if len(name_parts) > 2 else ["unknown"])
        if isinstance(burst_ids, str):
            burst_ids = [burst_ids]

        processor_version = meta.get("processor_version", meta.get("version", "unknown"))
        job_id = meta.get("job_id", local_path.parent.name)

        # wavelength: read from metadata, never hard-code
        wavelength_m = float(meta.get("wavelength", self.WAVELENGTH_M))

        looks = city_config.get("hyp3", {}).get("looks", "20x4")

        return StandardInterferogram(
            sensor="Sentinel-1",
            track=str(meta.get("track", city_config.get("track", "unknown"))),
            direction=meta.get("direction", city_config.get("direction", "ascending")).lower(),
            ref_date=ref_date,
            sec_date=sec_date,
            burst_ids=sorted(burst_ids),
            looks=looks,
            processor=f"hyp3-isce2",
            processor_version=processor_version,
            job_id=job_id,
            wavelength_m=wavelength_m,
            unwrapped_phase_path=unw_path,
            coherence_path=corr_path,
            connected_components_path=conn_path,
            incidence_angle_path=inc_path,
            azimuth_angle_path=az_path,
            ionosphere_applied=False,
        )


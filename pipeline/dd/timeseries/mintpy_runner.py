"""
pipeline/dd/timeseries/mintpy_runner.py

Drives MintPy SBAS inversion for one city.

This module:
1. Generates a MintPy config (smallbaselineApp.cfg) from the city YAML
2. Runs the HyP3 → MintPy reader to load the downloaded interferograms
3. Executes smallbaselineApp.py (via subprocess or Python API)
4. Extracts outputs: velocity, velocity_sigma, coherence, timeseries,
   seasonal_amplitude, reference_point
5. Returns paths to the intermediate HDF5 files

Reference: https://mintpy.readthedocs.io/en/latest/tutorials/smallbaselineApp/
           HyP3 MintPy tutorial: https://hyp3-docs.asf.alaska.edu/using/mintpy/
"""

from __future__ import annotations

import logging
import subprocess
import sys
from pathlib import Path
from typing import Optional

import yaml

log = logging.getLogger(__name__)


MINTPY_CFG_TEMPLATE = """\
##--------- Project ----------------------------------- ##
mintpy.compute.cluster          = no
mintpy.compute.numWorker        = auto

##--------- Load Data --------------------------------- ##
mintpy.load.processor           = hyp3
mintpy.load.updateMode          = yes
mintpy.load.compression         = lzf

mintpy.load.unwFile             = {unw_pattern}
mintpy.load.corFile             = {cor_pattern}
mintpy.load.connCompFile        = {conncomp_pattern}
mintpy.load.metaFile            = {meta_file}
mintpy.load.demFile             = {dem_file}

##--------- Modify Network ---------------------------- ##
mintpy.network.coherenceBased   = yes
mintpy.network.minCoherence     = {min_coherence}
mintpy.network.startDate        = auto
mintpy.network.endDate          = auto

##--------- Reference Point --------------------------- ##
mintpy.reference.yx             = auto
mintpy.reference.lalo           = {ref_lat},{ref_lon}
mintpy.reference.maskFile       = no

##--------- Troposphere Correction ------------------- ##
mintpy.troposphericDelay.method = {tropo_method}

##--------- Topographic Residual --------------------- ##
mintpy.topographicResidual      = yes

##--------- Mask ------------------------------------ ##
mintpy.networkInversion.maskDataset      = coherence
mintpy.networkInversion.maskThreshold    = {min_coherence}
mintpy.networkInversion.weightFunc       = sbas

##--------- Inversion -------------------------------- ##
mintpy.networkInversion.solver          = lscov

##--------- Velocity --------------------------------- ##
mintpy.velocity.startDate               = auto
mintpy.velocity.endDate                 = auto
mintpy.velocity.excludeDate             = no

##--------- Geocode ---------------------------------- ##
mintpy.geocode.laloStep                 = -0.001,0.001
mintpy.geocode.SNWE                     = {south},{north},{west},{east}
mintpy.geocode.interpMethod             = linear
mintpy.geocode.fillValue                = nan

##--------- Google Earth ------------------------------ ##
mintpy.save.kmz                         = no
"""


def write_mintpy_config(
    city_config: dict,
    work_dir: Path,
    raw_dir: Path,
) -> Path:
    """
    Generate a MintPy smallbaselineApp.cfg file from city config.

    Parameters
    ----------
    city_config : loaded city YAML dict
    work_dir    : MintPy working directory (e.g. data/mintpy/<slug>/)
    raw_dir     : where HyP3 downloads live

    Returns
    -------
    Path to the written .cfg file
    """
    aoi = city_config["aoi"]
    hyp3 = city_config.get("hyp3", {})
    qc = city_config.get("qc", {})
    tropo = city_config.get("troposphere", {})

    # Reference point: prefer explicit setting, else use config default
    ref = city_config.get("reference_point", {})
    ref_lat = ref.get("lat", (aoi["north"] + aoi["south"]) / 2)
    ref_lon = ref.get("lon", (aoi["west"] + aoi["east"]) / 2)

    cfg_text = MINTPY_CFG_TEMPLATE.format(
        unw_pattern=str(raw_dir / "**" / "*.unw_phase.tif"),
        cor_pattern=str(raw_dir / "**" / "*.corr.tif"),
        conncomp_pattern=str(raw_dir / "**" / "*.conncomp.tif"),
        meta_file=str(raw_dir / "geometry" / "incidenceAngle.tif"),
        dem_file=str(raw_dir / "geometry" / "dem.tif"),
        min_coherence=qc.get("min_coherence", 0.3),
        ref_lat=ref_lat,
        ref_lon=ref_lon,
        tropo_method=tropo.get("method", "pyaps"),  # ERA5 via PyAPS, or "linear"
        south=aoi["south"],
        north=aoi["north"],
        west=aoi["west"],
        east=aoi["east"],
    )

    work_dir.mkdir(parents=True, exist_ok=True)
    cfg_path = work_dir / "smallbaselineApp.cfg"
    cfg_path.write_text(cfg_text)
    log.info("MintPy config written: %s", cfg_path)
    return cfg_path


def run_mintpy(
    cfg_path: Path,
    work_dir: Path,
    *,
    steps: Optional[list[str]] = None,
) -> dict:
    """
    Run MintPy smallbaselineApp for the given config.

    Parameters
    ----------
    cfg_path : path to the .cfg file
    work_dir : working directory (MintPy writes outputs here)
    steps    : if given, run only these steps (e.g. ["load_data", "invert_network"])

    Returns
    -------
    dict with paths to output HDF5 files
    """
    cmd = [sys.executable, "-m", "mintpy.smallbaselineApp", str(cfg_path)]
    if steps:
        cmd += ["--dostep", ",".join(steps)]

    log.info("Running MintPy: %s", " ".join(cmd))
    result = subprocess.run(
        cmd,
        cwd=work_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        log.error("MintPy stdout:\n%s", result.stdout[-3000:])
        log.error("MintPy stderr:\n%s", result.stderr[-3000:])
        raise RuntimeError(f"MintPy failed (exit {result.returncode})")

    log.info("MintPy completed successfully")

    # Standard MintPy output files
    geo_dir = work_dir / "geo"
    outputs = {
        "velocity_h5": work_dir / "velocity.h5",
        "timeseries_h5": work_dir / "timeseries.h5",
        "temporal_coherence_h5": work_dir / "temporalCoherence.h5",
        "geo_velocity": geo_dir / "geo_velocity.h5",
        "geo_timeseries": geo_dir / "geo_timeseries.h5",
        "geo_temporal_coherence": geo_dir / "geo_temporalCoherence.h5",
    }
    return {k: v for k, v in outputs.items() if v.exists()}


"""
pipeline/dd/publish/export.py

Export MintPy outputs to the contract product format.

Writes (files only — no DB or MinIO loading; that is Saksham's job):
  - velocity.tif          (mm/yr, LOS, positive toward satellite)
  - velocity_sigma.tif    (mm/yr)
  - coherence.tif         (0..1, masked where < min_coherence)
  - seasonal_amp.tif      (mm)
  - timeseries.zarr       (dims: time × y × x; vars: disp, sigma; mm)
  - snapshots/displacement_YYYY-MM-DD.tif  (quarter-end epochs)
  - interferograms.json
  - meta.json
  - cost.json

All rasters: EPSG:4326, Cloud-Optimized GeoTIFF, float32, nodata=-9999.

Convention: velocity is LOS, positive toward satellite (MintPy default).
LOS is NEVER silently called vertical.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import numpy as np

log = logging.getLogger(__name__)

NODATA = -9999.0
EPSG = 4326


# ---------------------------------------------------------------------------
# COG writer helpers
# ---------------------------------------------------------------------------

def _write_cog(
    array: np.ndarray,
    profile: dict,
    out_path: Path,
    *,
    nodata: float = NODATA,
    compress: str = "deflate",
    predictor: int = 3,
) -> None:
    """Write array as a Cloud-Optimized GeoTIFF."""
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.crs import CRS

    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = out_path.with_suffix(".tmp.tif")

    profile = {**profile}
    profile.update(
        driver="GTiff",
        dtype="float32",
        nodata=nodata,
        crs=CRS.from_epsg(EPSG),
        count=1,
        compress=compress,
        predictor=predictor,
    )

    # Write intermediate
    with rasterio.open(tmp_path, "w", **profile) as dst:
        dst.write(array.astype(np.float32), 1)

    # Convert to COG
    import subprocess, sys
    result = subprocess.run(
        [
            "gdal_translate",
            "-of", "COG",
            "-co", f"COMPRESS={compress.upper()}",
            "-co", "PREDICTOR=YES",
            "-co", "OVERVIEWS=IGNORE_EXISTING",
            str(tmp_path),
            str(out_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        # Fallback: just move the tmp file (not a true COG but functional)
        tmp_path.replace(out_path)
        log.warning("gdal_translate COG failed; wrote plain GeoTIFF: %s", out_path)
    else:
        tmp_path.unlink(missing_ok=True)


def _read_mintpy_geo(h5_path: Path, dataset: str) -> tuple[np.ndarray, dict]:
    """Read a geocoded dataset from a MintPy HDF5 file."""
    import h5py
    import rasterio
    from rasterio.transform import from_bounds

    with h5py.File(h5_path, "r") as f:
        data = f[dataset][:]
        # Try to get geolocation from attributes
        lats = f.get("latitude", f.get("y", None))
        lons = f.get("longitude", f.get("x", None))
        attrs = dict(f[dataset].attrs)

    # Build a minimal rasterio profile
    if hasattr(data, "shape") and len(data.shape) >= 2:
        rows, cols = data.shape[-2], data.shape[-1]
    else:
        rows, cols = 1, data.size

    profile = {"height": rows, "width": cols}
    return data.astype(np.float32), profile


# ---------------------------------------------------------------------------
# Main export function
# ---------------------------------------------------------------------------

def publish_products(
    slug: str,
    version: int,
    mintpy_work_dir: Path,
    city_config: dict,
    *,
    interferograms_meta: list[dict] | None = None,
    cost_data: dict | None = None,
    synthetic: bool = False,
    force: bool = False,
) -> dict:
    """
    Export MintPy products to data/products/<slug>/v<version>/.

    Parameters
    ----------
    slug             : city slug
    version          : product version integer
    mintpy_work_dir  : directory where MintPy wrote its outputs
    city_config      : loaded city YAML dict
    interferograms_meta : list of per-interferogram metadata dicts
    cost_data        : HyP3 credits and runtime data for cost.json
    synthetic        : if True, mark meta.json with synthetic: true
    force            : overwrite existing products

    Returns
    -------
    dict of written product paths
    """
    from pipeline.dd.config import products_dir

    out_dir = products_dir(slug, version)
    out_dir.mkdir(parents=True, exist_ok=True)
    snap_dir = out_dir / "snapshots"
    snap_dir.mkdir(exist_ok=True)
    browse_dir = out_dir / "browse"
    browse_dir.mkdir(exist_ok=True)

    written: dict[str, str] = {}
    t0 = time.time()

    geo_dir = mintpy_work_dir / "geo"

    # -----------------------------------------------------------------------
    # 1. velocity.tif  (mm/yr, LOS, +ve toward satellite)
    # -----------------------------------------------------------------------
    vel_h5 = geo_dir / "geo_velocity.h5"
    if vel_h5.exists():
        arr, profile = _read_mintpy_geo(vel_h5, "velocity")
        # MintPy stores velocity in m/yr → convert to mm/yr
        arr = arr * 1000.0
        # Replace NaN/inf with nodata
        arr = np.where(np.isfinite(arr), arr, NODATA)
        vel_path = out_dir / "velocity.tif"
        if not vel_path.exists() or force:
            _write_cog(arr, profile, vel_path)
            written["velocity.tif"] = str(vel_path)
            log.info("velocity.tif written")
    else:
        log.warning("geo_velocity.h5 not found — skipping velocity.tif")

    # -----------------------------------------------------------------------
    # 2. velocity_sigma.tif
    # -----------------------------------------------------------------------
    # MintPy stores velocity uncertainty in velocityStd dataset
    vel_std_h5 = geo_dir / "geo_velocity.h5"  # same file, different dataset
    if vel_std_h5.exists():
        try:
            arr_std, profile_std = _read_mintpy_geo(vel_std_h5, "velocityStd")
            arr_std = arr_std * 1000.0
            arr_std = np.where(np.isfinite(arr_std), arr_std, NODATA)
            vsig_path = out_dir / "velocity_sigma.tif"
            if not vsig_path.exists() or force:
                _write_cog(arr_std, profile_std, vsig_path)
                written["velocity_sigma.tif"] = str(vsig_path)
        except KeyError:
            log.warning("velocityStd not found in geo_velocity.h5")

    # -----------------------------------------------------------------------
    # 3. coherence.tif — temporal coherence from MintPy
    # -----------------------------------------------------------------------
    coh_h5 = geo_dir / "geo_temporalCoherence.h5"
    if coh_h5.exists():
        arr_coh, profile_coh = _read_mintpy_geo(coh_h5, "temporalCoherence")
        min_coh = city_config.get("qc", {}).get("min_coherence", 0.3)
        # Mask low-coherence pixels
        arr_coh = np.where(arr_coh >= min_coh, arr_coh, NODATA)
        arr_coh = np.where(np.isfinite(arr_coh), arr_coh, NODATA)
        coh_path = out_dir / "coherence.tif"
        if not coh_path.exists() or force:
            _write_cog(arr_coh, profile_coh, coh_path)
            written["coherence.tif"] = str(coh_path)

    # -----------------------------------------------------------------------
    # 4. timeseries.zarr
    # -----------------------------------------------------------------------
    ts_h5 = geo_dir / "geo_timeseries.h5"
    if ts_h5.exists():
        zarr_path = out_dir / "timeseries.zarr"
        if not zarr_path.exists() or force:
            _export_zarr(ts_h5, zarr_path)
            written["timeseries.zarr"] = str(zarr_path)

    # -----------------------------------------------------------------------
    # 5. seasonal_amp.tif (Yash-only; Shivani reads it)
    # -----------------------------------------------------------------------
    samp_path = out_dir / "seasonal_amp.tif"
    if not samp_path.exists() or force:
        _export_seasonal_amp(ts_h5 if ts_h5.exists() else None, samp_path, profile if vel_h5.exists() else {})
        if samp_path.exists():
            written["seasonal_amp.tif"] = str(samp_path)

    # -----------------------------------------------------------------------
    # 6. Snapshots (quarter-end displacement epochs)
    # -----------------------------------------------------------------------
    snap_written = _export_snapshots(ts_h5 if ts_h5.exists() else None, snap_dir, force=force)
    written.update(snap_written)

    # -----------------------------------------------------------------------
    # 7. meta.json
    # -----------------------------------------------------------------------
    hyp3_cfg = city_config.get("hyp3", {})
    tropo_method = city_config.get("troposphere", {}).get("method", "none")
    n_ordered = len(interferograms_meta) if interferograms_meta else 0
    n_accepted = sum(1 for i in (interferograms_meta or []) if i.get("accepted"))
    n_rejected = n_ordered - n_accepted

    ref_pt = city_config.get("reference_point", {})

    meta = {
        "city": slug,
        "version": version,
        "synthetic": synthetic,
        "sensor": "Sentinel-1",
        "track": str(city_config.get("track", "TBD")),
        "direction": city_config.get("direction", "ascending"),
        "looks": hyp3_cfg.get("looks", "20x4"),
        "data_span": {
            "start": city_config.get("data_span", {}).get("start", "TBD"),
            "end": city_config.get("data_span", {}).get("end", "TBD"),
        },
        "n_interferograms": {
            "ordered": n_ordered,
            "accepted": n_accepted,
            "rejected": n_rejected,
        },
        "reference_point": {
            "lon": ref_pt.get("lon", 0.0),
            "lat": ref_pt.get("lat", 0.0),
            "mode": ref_pt.get("mode", "auto"),
        },
        "atmosphere": tropo_method,
        "processor": f"hyp3-isce2",
        "mintpy": _get_mintpy_version(),
    }
    meta_path = out_dir / "meta.json"
    with meta_path.open("w") as fh:
        json.dump(meta, fh, indent=2)
    written["meta.json"] = str(meta_path)

    # -----------------------------------------------------------------------
    # 8. interferograms.json
    # -----------------------------------------------------------------------
    if interferograms_meta is not None:
        ifg_path = out_dir / "interferograms.json"
        with ifg_path.open("w") as fh:
            json.dump(interferograms_meta, fh, indent=2)
        written["interferograms.json"] = str(ifg_path)

    # -----------------------------------------------------------------------
    # 9. cost.json
    # -----------------------------------------------------------------------
    if cost_data is not None:
        cost_path = out_dir / "cost.json"
        with cost_path.open("w") as fh:
            json.dump(cost_data, fh, indent=2)
        written["cost.json"] = str(cost_path)
    else:
        # Write placeholder (never ship placeholder numbers as real)
        cost_path = out_dir / "cost.json"
        placeholder = {
            "_note": "Placeholder — fill with measured values before release",
            "hyp3_credits_used": None,
            "download_volume_gb": None,
            "mintpy_wall_clock_sec": None,
            "mintpy_peak_memory_mb": None,
            "product_size_mb": None,
        }
        if not cost_path.exists():
            with cost_path.open("w") as fh:
                json.dump(placeholder, fh, indent=2)

    elapsed = time.time() - t0
    log.info("publish_products done in %.1f s. Written: %s", elapsed, list(written.keys()))
    return written


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _export_zarr(ts_h5: Path, zarr_path: Path) -> None:
    """
    Convert MintPy geo_timeseries.h5 to timeseries.zarr.

    Schema: dims (time, y, x), vars disp (mm) and sigma (mm).
    Chunks: full time axis × 64 × 64 spatial blocks.
    Compression: Zstd.
    """
    import h5py
    import xarray as xr
    import zarr
    import numcodecs

    with h5py.File(ts_h5, "r") as f:
        ts_data = f["timeseries"][:].astype(np.float32)  # (time, y, x) in metres
        dates = [d.decode() if isinstance(d, bytes) else d
                 for d in f["date"][:]]
        try:
            ts_std = f["timeseriesStd"][:].astype(np.float32)
        except KeyError:
            ts_std = np.zeros_like(ts_data)

    # Convert metres → mm
    disp_mm = ts_data * 1000.0
    sigma_mm = ts_std * 1000.0

    # nodata mask
    disp_mm = np.where(np.isfinite(disp_mm), disp_mm, NODATA)
    sigma_mm = np.where(np.isfinite(sigma_mm), sigma_mm, NODATA)

    nt, ny, nx = disp_mm.shape
    chunks = (nt, min(64, ny), min(64, nx))

    compressor = numcodecs.Zstd(level=5)

    store = zarr.open(str(zarr_path), mode="w")
    store.create_dataset(
        "disp",
        data=disp_mm,
        chunks=chunks,
        compressor=compressor,
        dtype="float32",
    )
    store.create_dataset(
        "sigma",
        data=sigma_mm,
        chunks=chunks,
        compressor=compressor,
        dtype="float32",
    )
    store.attrs["dates"] = dates
    store.attrs["units"] = "mm"
    store.attrs["convention"] = "positive = toward satellite, line-of-sight, relative to reference point"
    store.attrs["dims"] = ["time", "y", "x"]
    log.info("timeseries.zarr written (%d epochs, %d×%d)", nt, ny, nx)


def _export_seasonal_amp(
    ts_h5: Optional[Path],
    out_path: Path,
    profile: dict,
) -> None:
    """
    Fit per-pixel seasonal amplitude from the time series and write seasonal_amp.tif.
    """
    if ts_h5 is None or not ts_h5.exists():
        log.warning("timeseries HDF5 not found — cannot compute seasonal_amp.tif")
        return

    import h5py
    from pipeline.dd.timeseries.seasonal_fit import fit_velocity_seasonal, decimal_year

    with h5py.File(ts_h5, "r") as f:
        ts_data = f["timeseries"][:].astype(np.float64) * 1000.0  # metres → mm
        dates = [d.decode() if isinstance(d, bytes) else d for d in f["date"][:]]

    nt, ny, nx = ts_data.shape
    seasonal_amp = np.full((ny, nx), NODATA, dtype=np.float32)

    for iy in range(ny):
        for ix in range(nx):
            pixel = ts_data[:, iy, ix]
            if np.all(pixel == NODATA) or np.all(~np.isfinite(pixel)):
                continue
            result = fit_velocity_seasonal(dates, pixel)
            if result["status"] == "ok" and result["seasonal_amp_mm"] is not None:
                seasonal_amp[iy, ix] = result["seasonal_amp_mm"]

    _write_cog(seasonal_amp, profile, out_path)
    log.info("seasonal_amp.tif written")


def _export_snapshots(
    ts_h5: Optional[Path],
    snap_dir: Path,
    *,
    force: bool = False,
) -> dict:
    """Export quarter-end displacement epochs as individual COGs."""
    if ts_h5 is None or not ts_h5.exists():
        return {}

    import h5py

    QUARTER_MONTHS = {3, 6, 9, 12}

    with h5py.File(ts_h5, "r") as f:
        ts_data = f["timeseries"][:].astype(np.float32) * 1000.0  # mm
        dates = [d.decode() if isinstance(d, bytes) else d for d in f["date"][:]]
        # profile info
        ny, nx = ts_data.shape[-2], ts_data.shape[-1]

    written = {}
    for i, d_str in enumerate(dates):
        d = date.fromisoformat(d_str[:10])
        if d.month in QUARTER_MONTHS:
            arr = ts_data[i]
            arr = np.where(np.isfinite(arr), arr, NODATA)
            fname = f"displacement_{d_str[:10]}.tif"
            snap_path = snap_dir / fname
            if not snap_path.exists() or force:
                profile = {"height": ny, "width": nx}  # minimal; _write_cog adds more
                _write_cog(arr, profile, snap_path)
                written[f"snapshots/{fname}"] = str(snap_path)
    return written


def _get_mintpy_version() -> str:
    try:
        import mintpy
        return getattr(mintpy, "__version__", "unknown")
    except ImportError:
        return "not_installed"


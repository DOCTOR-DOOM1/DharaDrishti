"""
pipeline/dd/fixtures/generator.py

Synthetic Fixture Generator (D-1 in Zero-Overlap Plan).
Owned by Shivani.

Writes full contract products to `data/fixture/<slug>/v1/` with synthetic: true.
Generates:
  - velocity.tif (Gaussian subsidence bowls + noise + stable area)
  - velocity_sigma.tif
  - coherence.tif (masked where < 0.3)
  - seasonal_amp.tif
  - timeseries.zarr (40 epochs, consistent with velocity)
  - snapshots/displacement_YYYY-MM-DD.tif
  - interferograms.json
  - meta.json
"""

import json
import math
from datetime import date, timedelta
from pathlib import Path
import numpy as np
import tifffile
import zarr

NODATA = -9999.0
GRID_SHAPE = (300, 300)  # (ny, nx)

# AOI: Lon 76.95 to 77.40, Lat 28.30 to 28.65
LON_MIN, LON_MAX = 76.95, 77.40
LAT_MIN, LAT_MAX = 28.30, 28.65
DX = (LON_MAX - LON_MIN) / GRID_SHAPE[1]
DY = (LAT_MAX - LAT_MIN) / GRID_SHAPE[0]


def save_geotiff(path: Path, array: np.ndarray):
    """
    Save float32 array as GeoTIFF with EPSG:4326 metadata.
    Tiepoint at (0, 0, 0) -> (LON_MIN, LAT_MAX, 0.0)
    PixelScale -> (DX, DY, 0.0)
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    arr = array.astype(np.float32)

    # GeoTIFF metadata tags
    # 33550: ModelPixelScaleTag (ScaleX, ScaleY, ScaleZ)
    # 33922: ModelTiepointTag (I, J, K, X, Y, Z)
    # 34735: GeoKeyDirectoryTag (standard EPSG:4326 key directory)
    # 42113: GDAL_NODATA
    extratags = [
        (33550, "d", 3, (DX, DY, 0.0), False),
        (33922, "d", 6, (0.0, 0.0, 0.0, LON_MIN, LAT_MAX, 0.0), False),
        (34735, "H", 16, (
            1, 1, 0, 3,       # Header: KeyDirectoryVersion, KeyRevision, MinorRev, NumberOfKeys
            1024, 0, 1, 2,    # GTModelTypeGeoKey = 2 (ModelTypeGeographic)
            1025, 0, 1, 1,    # GTRasterTypeGeoKey = 1 (RasterPixelIsArea)
            2048, 0, 1, 4326  # GeographicTypeGeoKey = 4326 (WGS 84)
        ), False),
        (42113, "s", len(str(NODATA)) + 1, f"{NODATA}\x00", False)
    ]

    tifffile.imwrite(
        str(path),
        arr,
        extratags=extratags,
        photometric="minisblack",
    )


def generate_fixture(slug: str = "delhi-ncr", dest_root: Path = None) -> dict:
    """Generate complete synthetic dataset for fixture/delhi-ncr/v1/"""
    if dest_root is None:
        dest_root = Path("d:/DharaDrishti/data/fixture") / slug / "v1"

    dest_root.mkdir(parents=True, exist_ok=True)
    snap_dir = dest_root / "snapshots"
    snap_dir.mkdir(exist_ok=True)
    browse_dir = dest_root / "browse"
    browse_dir.mkdir(exist_ok=True)

    rng = np.random.default_rng(42)
    ny, nx = GRID_SHAPE

    # Coordinate grids
    lats = np.linspace(LAT_MAX, LAT_MIN, ny)
    lons = np.linspace(LON_MIN, LON_MAX, nx)
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    # 1. Base Velocity Field with 3 Gaussian Subsidence Bowls
    # Center 1: Kapashera / Dwarka border (~28.52 N, 77.08 E)
    # Center 2: Faridabad (~28.41 N, 77.31 E)
    # Center 3: Najafgarh / Western basin (~28.61 N, 76.99 E)
    v_field = rng.normal(0.0, 1.2, GRID_SHAPE).astype(np.float32)

    # Bowl 1: Major Kapashera subsidence bowl (-55 mm/yr peak)
    d1_sq = ((lat_grid - 28.52) / 0.04)**2 + ((lon_grid - 77.08) / 0.04)**2
    v_field -= 55.0 * np.exp(-d1_sq).astype(np.float32)

    # Bowl 2: Faridabad industrial bowl (-32 mm/yr peak)
    d2_sq = ((lat_grid - 28.41) / 0.05)**2 + ((lon_grid - 77.31) / 0.05)**2
    v_field -= 32.0 * np.exp(-d2_sq).astype(np.float32)

    # Bowl 3: Najafgarh bowl (-25 mm/yr peak)
    d3_sq = ((lat_grid - 28.61) / 0.035)**2 + ((lon_grid - 76.99) / 0.035)**2
    v_field -= 25.0 * np.exp(-d3_sq).astype(np.float32)

    # Minor tectonic/uplift signal (+4 mm/yr in north ridge)
    d4_sq = ((lat_grid - 28.60) / 0.04)**2 + ((lon_grid - 77.22) / 0.04)**2
    v_field += 4.0 * np.exp(-d4_sq).astype(np.float32)

    # 2. Velocity Sigma (standard error: 1.5 to 4.5 mm/yr)
    v_sigma = 1.8 + 0.8 * rng.random(GRID_SHAPE).astype(np.float32)
    # Higher uncertainty at boundary
    v_sigma += (np.abs(lon_grid - (LON_MIN + LON_MAX)/2) / 0.225) * 1.5

    # 3. Coherence (0.0 to 1.0)
    coherence = 0.75 + 0.15 * rng.standard_normal(GRID_SHAPE).astype(np.float32)
    # Yamuna river low-coherence corridor
    river_line = 77.21 + (lat_grid - 28.30) * 0.12
    river_dist = np.abs(lon_grid - river_line)
    coherence = np.where(river_dist < 0.015, coherence * 0.2, coherence)
    # Water bodies / agricultural mask (coherence < 0.3)
    coherence = np.clip(coherence, 0.05, 0.98)

    # Mask low coherence pixels in velocity and sigma
    mask_invalid = coherence < 0.30
    v_field[mask_invalid] = NODATA
    v_sigma[mask_invalid] = NODATA

    # 4. Seasonal Amplitude (mm, typically 2 to 8 mm)
    seasonal_amp = 3.5 + 2.0 * np.sin((lat_grid - 28.30) * 8.0).astype(np.float32) + rng.normal(0, 0.5, GRID_SHAPE).astype(np.float32)
    seasonal_amp = np.clip(seasonal_amp, 0.5, 12.0)
    seasonal_amp[mask_invalid] = NODATA

    # Save Rasters
    save_geotiff(dest_root / "velocity.tif", v_field)
    save_geotiff(dest_root / "velocity_sigma.tif", v_sigma)
    save_geotiff(dest_root / "coherence.tif", np.where(mask_invalid, NODATA, coherence))
    save_geotiff(dest_root / "seasonal_amp.tif", seasonal_amp)

    # 5. Time Series Zarr (40 epochs, 12-day cadence)
    n_epochs = 40
    start_date = date(2021, 1, 5)
    dates = [(start_date + timedelta(days=12 * i)).isoformat() for i in range(n_epochs)]
    
    times_years = np.array([(date.fromisoformat(d) - start_date).days / 365.25 for d in dates], dtype=np.float32)
    
    # Pre-allocate 3D arrays
    disp_3d = np.full((n_epochs, ny, nx), NODATA, dtype=np.float32)
    sigma_3d = np.full((n_epochs, ny, nx), NODATA, dtype=np.float32)

    valid_mask = ~mask_invalid
    for t_idx, t_yr in enumerate(times_years):
        # Displacement = v * t + seasonal_amp * sin(2*pi*t) + noise
        disp_epoch = (
            v_field * t_yr
            + seasonal_amp * np.sin(2 * np.pi * t_yr)
            + rng.normal(0, 1.5, GRID_SHAPE).astype(np.float32)
        )
        disp_epoch[mask_invalid] = NODATA
        disp_3d[t_idx] = disp_epoch
        sigma_3d[t_idx] = np.where(valid_mask, v_sigma * np.sqrt(1.0 + t_yr), NODATA)

    # Write to Zarr
    zarr_path = dest_root / "timeseries.zarr"
    root_z = zarr.open_group(str(zarr_path), mode="w")

    def _write_zarr_ds(grp, name, data, chunks):
        if hasattr(grp, "create_array"):
            grp.create_array(name, data=data, chunks=chunks)
        elif hasattr(grp, "create_dataset"):
            grp.create_dataset(name, data=data, chunks=chunks, dtype="float32")
        else:
            grp[name] = data

    _write_zarr_ds(root_z, "disp", disp_3d, (n_epochs, 64, 64))
    _write_zarr_ds(root_z, "sigma", sigma_3d, (n_epochs, 64, 64))
    root_z.attrs["dates"] = dates
    root_z.attrs["units"] = "mm"
    root_z.attrs["convention"] = "positive = toward satellite, line-of-sight, relative to reference point"
    root_z.attrs["dims"] = ["time", "y", "x"]

    # 6. Snapshots for quarter-ends
    quarter_epochs = [5, 15, 25, 35]  # ~Quarter ends
    for q_idx in quarter_epochs:
        snap_date = dates[q_idx]
        snap_file = snap_dir / f"displacement_{snap_date}.tif"
        save_geotiff(snap_file, disp_3d[q_idx])

    # 7. Interferograms JSON (Synthetic catalogue)
    interferograms = []
    for i in range(len(dates) - 1):
        ref_d = dates[i]
        sec_d = dates[i + 1]
        dt_days = 12
        accepted = (i % 7 != 4)  # reject ~15% for realistic QC
        mean_c = round(float(np.mean(coherence[valid_mask])) + rng.normal(0, 0.05), 3)
        if not accepted:
            reason = "low_coherence (0.24 < 0.30)"
            mean_c = 0.24
        else:
            reason = None

        interferograms.append({
            "id": f"ifg-{ref_d.replace('-','')}-{sec_d.replace('-','')}",
            "ref_date": ref_d,
            "sec_date": sec_d,
            "temporal_baseline_days": dt_days,
            "accepted": accepted,
            "rejection_reason": reason,
            "mean_coherence": mean_c,
            "browse_url": f"/api/cities/{slug}/interferograms/browse_{ref_d}_{sec_d}.png",
            "sensor": "Sentinel-1",
            "track": "85",
            "direction": "ascending",
            "looks": "20x4",
            "processor": "hyp3-isce2",
            "processor_version": "2.9.0",
            "job_id": f"job-synth-{i:03d}",
            "synthetic": True,
        })

    with open(dest_root / "interferograms.json", "w") as f:
        json.dump(interferograms, f, indent=2)

    # 8. meta.json
    meta = {
        "city": slug,
        "version": 1,
        "synthetic": True,
        "sensor": "Sentinel-1",
        "track": "85",
        "direction": "ascending",
        "looks": "20x4",
        "data_span": {"start": dates[0], "end": dates[-1]},
        "n_interferograms": {
            "ordered": len(interferograms),
            "accepted": sum(1 for x in interferograms if x["accepted"]),
            "rejected": sum(1 for x in interferograms if not x["accepted"]),
        },
        "reference_point": {"lon": 77.18, "lat": 28.62, "mode": "manual"},
        "atmosphere": "era5",
        "processor": "hyp3-isce2 2.9.0",
        "mintpy": "1.5.3"
    }
    with open(dest_root / "meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    # 9. cost.json
    cost = {
        "synthetic": True,
        "hyp3_credits_used": 0,
        "download_volume_gb": 0.0,
        "mintpy_wall_clock_sec": 0.0,
        "mintpy_peak_memory_mb": 0.0,
        "product_size_mb": 42.5
    }
    with open(dest_root / "cost.json", "w") as f:
        json.dump(cost, f, indent=2)

    return {
        "status": "success",
        "dest": str(dest_root),
        "files_generated": [
            "velocity.tif", "velocity_sigma.tif", "coherence.tif", "seasonal_amp.tif",
            "timeseries.zarr", "interferograms.json", "meta.json", "cost.json"
        ]
    }

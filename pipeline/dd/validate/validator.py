"""
pipeline/dd/validate/validator.py

Validation comparison engine (D-5 in Zero-Overlap Plan).
Owned by Shivani.

Compares published ground measurements and published InSAR papers
against our computed velocity values at known coordinates.
Honest reporting: never tunes to match; records basis, period, differences.
"""

import json
from pathlib import Path
import numpy as np
import tifffile
import yaml

from pipeline.dd.fixtures.generator import NODATA, LON_MIN, LON_MAX, LAT_MIN, LAT_MAX, GRID_SHAPE


def validate_against_references(data_dir: Path, slug: str = "delhi-ncr") -> dict:
    """
    Extract pixel values at validation sites and compare with references.json.
    """
    vel_file = data_dir / "velocity.tif"
    sig_file = data_dir / "velocity_sigma.tif"
    ref_file = data_dir / "references.json"

    if not vel_file.exists():
        raise FileNotFoundError(f"Missing {vel_file}")

    v_arr = tifffile.imread(str(vel_file)).astype(np.float32)
    s_arr = tifffile.imread(str(sig_file)).astype(np.float32) if sig_file.exists() else None

    # Coordinate lookup
    ny, nx = GRID_SHAPE
    lats = np.linspace(LAT_MAX, LAT_MIN, ny)
    lons = np.linspace(LON_MIN, LON_MAX, nx)

    with open(ref_file, "r") as f:
        refs = json.load(f)

    results = []
    # Known site coordinates
    coords = {
        "Kapashera / Dwarka": (28.52, 77.08),
        "Delhi NCR / IGI Airport": (28.56, 77.10),
        "Faridabad": (28.41, 77.31)
    }

    for ref in refs:
        area = ref.get("area_name", "")
        target_lat, target_lon = coords.get(area, (28.52, 77.08))

        # Find closest pixel
        iy = int(np.argmin(np.abs(lats - target_lat)))
        ix = int(np.argmin(np.abs(lons - target_lon)))

        our_val = float(v_arr[iy, ix]) if v_arr[iy, ix] != NODATA else None
        our_sig = float(s_arr[iy, ix]) if (s_arr is not None and s_arr[iy, ix] != NODATA) else 0.0

        diff = round(our_val - ref["reported_rate"], 2) if our_val is not None else None

        results.append({
            "citation": ref["citation"],
            "area_name": area,
            "period_published": ref["period"],
            "published_rate": ref["reported_rate"],
            "published_basis": ref["rate_basis"],
            "our_rate": our_val,
            "our_sigma": our_sig,
            "difference": diff,
            "notes": "Differences expected due to temporal baseline differences and LOS look angle."
        })

    return {
        "city": slug,
        "comparisons": results
    }

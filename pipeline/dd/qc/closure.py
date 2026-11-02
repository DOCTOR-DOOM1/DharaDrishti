"""
pipeline/dd/qc/closure.py

Closure-phase triplet check.

For any triplet (A→B, B→C, A→C), the closure phase should be ~0
for correctly unwrapped phases. Large closure residuals indicate
unwrapping errors or ionospheric artifacts.

Reference: Zheng & Zebker 2017; Ansari et al. 2021
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import numpy as np

log = logging.getLogger(__name__)


def compute_closure_phase(
    phase_ab: np.ndarray,
    phase_bc: np.ndarray,
    phase_ac: np.ndarray,
    *,
    nodata: float = -9999.0,
) -> np.ndarray:
    """
    Closure phase = φ_AB + φ_BC - φ_AC (radians).

    All arrays must be same shape. nodata pixels are set to NaN.
    """
    closure = np.full_like(phase_ab, np.nan, dtype=np.float32)
    valid = (
        (phase_ab != nodata) &
        (phase_bc != nodata) &
        (phase_ac != nodata) &
        np.isfinite(phase_ab) &
        np.isfinite(phase_bc) &
        np.isfinite(phase_ac)
    )
    closure[valid] = phase_ab[valid] + phase_bc[valid] - phase_ac[valid]
    return closure


def check_closure(
    phase_ab: np.ndarray,
    phase_bc: np.ndarray,
    phase_ac: np.ndarray,
    *,
    max_mean_abs_rad: float = 1.0,
    nodata: float = -9999.0,
) -> dict:
    """
    Compute closure phase and flag if mean |closure| exceeds threshold.

    Returns:
        {
            "ok": bool,
            "mean_abs_closure_rad": float,
            "max_allowed_rad": float,
            "reason": str | None,
        }
    """
    closure = compute_closure_phase(phase_ab, phase_bc, phase_ac, nodata=nodata)
    valid = closure[np.isfinite(closure)]

    if valid.size == 0:
        return {
            "ok": False,
            "mean_abs_closure_rad": None,
            "max_allowed_rad": max_mean_abs_rad,
            "reason": "no_valid_closure_pixels",
        }

    mean_abs = float(np.mean(np.abs(valid)))
    ok = mean_abs <= max_mean_abs_rad
    return {
        "ok": ok,
        "mean_abs_closure_rad": round(mean_abs, 4),
        "max_allowed_rad": max_mean_abs_rad,
        "reason": None if ok else (
            f"high_closure_phase ({mean_abs:.3f} rad > {max_mean_abs_rad} rad)"
        ),
    }


def run_closure_check_from_files(
    path_ab: Path,
    path_bc: Path,
    path_ac: Path,
    *,
    max_mean_abs_rad: float = 1.0,
) -> dict:
    """
    Load three unwrapped phase rasters and run the closure check.
    """
    try:
        import rasterio
        def _read(p: Path) -> np.ndarray:
            with rasterio.open(p) as ds:
                return ds.read(1).astype(np.float32)

        ab = _read(path_ab)
        bc = _read(path_bc)
        ac = _read(path_ac)
    except Exception as exc:
        return {
            "ok": False,
            "mean_abs_closure_rad": None,
            "max_allowed_rad": max_mean_abs_rad,
            "reason": f"read_error: {exc}",
        }

    return check_closure(ab, bc, ac, max_mean_abs_rad=max_mean_abs_rad)


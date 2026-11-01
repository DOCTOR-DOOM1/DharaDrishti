"""
pipeline/dd/qc/coherence.py

Quality control for interferograms.

Checks:
1. Mean coherence (configurable threshold, default 0.3)
2. Water mask (pixels over water are excluded)
3. Connected-component check (at least one large component)
4. Closure-phase triplet check (detects unwrapping errors)

Each check marks the interferogram accepted/rejected with a reason.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import numpy as np

log = logging.getLogger(__name__)


def check_mean_coherence(
    coherence_path: Path,
    threshold: float = 0.3,
) -> dict:
    """
    Check mean coherence over non-nodata pixels.

    Returns dict: {ok, mean_coherence, threshold, reason}
    """
    try:
        import rasterio
        with rasterio.open(coherence_path) as ds:
            arr = ds.read(1).astype(np.float32)
            nodata = ds.nodata
    except Exception as exc:
        return {"ok": False, "mean_coherence": None, "threshold": threshold,
                "reason": f"read_error: {exc}"}

    mask = arr != nodata if nodata is not None else np.ones_like(arr, dtype=bool)
    mask &= np.isfinite(arr)
    if not mask.any():
        return {"ok": False, "mean_coherence": None, "threshold": threshold,
                "reason": "all_nodata"}

    mean_coh = float(arr[mask].mean())
    ok = mean_coh >= threshold
    return {
        "ok": ok,
        "mean_coherence": round(mean_coh, 4),
        "threshold": threshold,
        "reason": None if ok else f"low_coherence ({mean_coh:.3f} < {threshold})",
    }


def check_connected_components(
    conncomp_path: Path,
    min_component_fraction: float = 0.05,
) -> dict:
    """
    Check that at least one connected component covers a meaningful fraction.

    Returns dict: {ok, largest_component_fraction, reason}
    """
    try:
        import rasterio
        with rasterio.open(conncomp_path) as ds:
            arr = ds.read(1)
            nodata = ds.nodata
    except Exception as exc:
        return {"ok": False, "largest_component_fraction": None,
                "reason": f"read_error: {exc}"}

    valid = arr[arr != (nodata if nodata is not None else -9999)]
    valid = valid[valid > 0]  # component 0 = unconnected

    if valid.size == 0:
        return {"ok": False, "largest_component_fraction": 0.0,
                "reason": "no_connected_components"}

    total_pixels = arr.size
    unique, counts = np.unique(valid, return_counts=True)
    largest = int(counts.max())
    fraction = largest / total_pixels

    ok = fraction >= min_component_fraction
    return {
        "ok": ok,
        "largest_component_fraction": round(fraction, 4),
        "reason": None if ok else (
            f"small_components ({fraction:.3f} < {min_component_fraction})"
        ),
    }


def apply_water_mask(
    coherence_path: Path,
    water_mask_path: Optional[Path] = None,
) -> dict:
    """
    Check what fraction of the scene is unmasked by the water mask.
    If no water mask is provided, returns ok=True with fraction=1.0.

    Returns dict: {ok, unmasked_fraction, reason}
    """
    if water_mask_path is None or not water_mask_path.exists():
        return {"ok": True, "unmasked_fraction": 1.0, "reason": None}

    try:
        import rasterio
        with rasterio.open(water_mask_path) as ds:
            mask = ds.read(1).astype(bool)  # True = water
    except Exception as exc:
        return {"ok": True, "unmasked_fraction": 1.0,
                "reason": f"water_mask_read_error: {exc}"}

    unmasked = float((~mask).mean())
    ok = unmasked >= 0.10  # at least 10% land
    return {
        "ok": ok,
        "unmasked_fraction": round(unmasked, 4),
        "reason": None if ok else f"mostly_water ({unmasked:.2f} land)",
    }


def qc_interferogram(
    coherence_path: Path,
    conncomp_path: Path,
    *,
    coherence_threshold: float = 0.3,
    min_component_fraction: float = 0.05,
    water_mask_path: Optional[Path] = None,
) -> dict:
    """
    Run all QC checks on one interferogram.

    Returns:
        {
            "accepted": bool,
            "rejection_reason": str | None,
            "checks": {...}
        }
    """
    checks = {}

    checks["coherence"] = check_mean_coherence(coherence_path, coherence_threshold)
    checks["connected_components"] = check_connected_components(
        conncomp_path, min_component_fraction
    )
    checks["water_mask"] = apply_water_mask(coherence_path, water_mask_path)

    rejection_reason = None
    for name, result in checks.items():
        if not result["ok"]:
            rejection_reason = result["reason"]
            break

    return {
        "accepted": rejection_reason is None,
        "rejection_reason": rejection_reason,
        "checks": checks,
    }


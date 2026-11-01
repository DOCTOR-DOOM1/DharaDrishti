"""
pipeline/dd/timeseries/seasonal_fit.py

Fit a linear trend + annual sinusoid to a displacement time series:

    d(t) = a + v·t + c·sin(2π·t) + s·cos(2π·t)

where t is in decimal years from the first epoch.

Outputs:
  - v      = velocity (mm/yr)
  - v_std  = velocity standard error (mm/yr)
  - c, s   = sine and cosine amplitudes (mm)
  - seasonal_amp = sqrt(c² + s²)  (mm)
  - phase_deg    = phase of seasonal cycle (degrees)

Convention: positive velocity = toward satellite (LOS), MintPy convention.
"""

from __future__ import annotations

import numpy as np
from typing import Optional


def decimal_year(date_str: str) -> float:
    """Convert ISO-8601 date string to decimal year."""
    from datetime import date
    d = date.fromisoformat(date_str[:10])
    year_start = date(d.year, 1, 1)
    year_end = date(d.year + 1, 1, 1)
    return d.year + (d - year_start).days / (year_end - year_start).days


def fit_velocity_seasonal(
    dates: list[str],
    displacements: np.ndarray,
    *,
    sigmas: Optional[np.ndarray] = None,
    nodata: float = -9999.0,
) -> dict:
    """
    Fit v·t + seasonal to a 1-D displacement time series.

    Parameters
    ----------
    dates : list of ISO-8601 date strings, length N
    displacements : 1-D array of shape (N,), mm
    sigmas : optional uncertainty array, same shape
    nodata : nodata value to mask

    Returns
    -------
    dict with keys:
        velocity_mm_yr, velocity_sigma_mm_yr,
        seasonal_amp_mm, seasonal_phase_deg,
        c, s (amplitudes of sin/cos terms),
        residual_rms_mm, n_epochs
    """
    t = np.array([decimal_year(d) for d in dates], dtype=np.float64)
    y = np.array(displacements, dtype=np.float64)

    # Mask nodata and NaN
    valid = (y != nodata) & np.isfinite(y)
    if sigmas is not None:
        sv = np.array(sigmas, dtype=np.float64)
        valid &= (sv != nodata) & np.isfinite(sv) & (sv > 0)
    else:
        sv = None

    n = valid.sum()
    if n < 4:
        return _null_result("too_few_epochs", n)

    t_v = t[valid] - t[valid].min()   # offset to start of series
    y_v = y[valid]

    # Design matrix: [1, t, sin(2π·t), cos(2π·t)]
    omega = 2 * np.pi
    A = np.column_stack([
        np.ones(n),
        t_v,
        np.sin(omega * t_v),
        np.cos(omega * t_v),
    ])

    if sv is not None:
        w = 1.0 / sv[valid] ** 2
        Aw = A * w[:, None]
        ATA = Aw.T @ A
        ATy = Aw.T @ y_v
    else:
        ATA = A.T @ A
        ATy = A.T @ y_v

    try:
        coeffs, residuals, rank, _ = np.linalg.lstsq(ATA, ATy, rcond=None)
    except np.linalg.LinAlgError as exc:
        return _null_result(str(exc), int(n))

    a, v, c, s = coeffs
    seasonal_amp = float(np.sqrt(c ** 2 + s ** 2))
    phase_deg = float(np.degrees(np.arctan2(s, c)) % 360)

    # Residuals and sigma
    y_pred = A @ coeffs
    res = y_v - y_pred
    rms = float(np.sqrt(np.mean(res ** 2)))

    # Velocity uncertainty: propagate from ATA^-1
    try:
        cov = np.linalg.inv(ATA)
        v_sigma = float(np.sqrt(cov[1, 1]) * rms) if sv is None else float(np.sqrt(cov[1, 1]))
    except np.linalg.LinAlgError:
        v_sigma = float("nan")

    return {
        "velocity_mm_yr": round(float(v), 4),
        "velocity_sigma_mm_yr": round(v_sigma, 4),
        "seasonal_amp_mm": round(seasonal_amp, 4),
        "seasonal_phase_deg": round(phase_deg, 2),
        "c_mm": round(float(c), 4),
        "s_mm": round(float(s), 4),
        "offset_mm": round(float(a), 4),
        "residual_rms_mm": round(rms, 4),
        "n_epochs": int(n),
        "status": "ok",
    }


def _null_result(reason: str, n_epochs: int) -> dict:
    return {
        "velocity_mm_yr": None,
        "velocity_sigma_mm_yr": None,
        "seasonal_amp_mm": None,
        "seasonal_phase_deg": None,
        "c_mm": None,
        "s_mm": None,
        "offset_mm": None,
        "residual_rms_mm": None,
        "n_epochs": n_epochs,
        "status": reason,
    }


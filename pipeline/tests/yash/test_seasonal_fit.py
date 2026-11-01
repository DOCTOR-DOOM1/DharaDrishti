"""
pipeline/tests/yash/test_seasonal_fit.py

Tests for the seasonal velocity fit.
"""

import numpy as np
import pytest
from pipeline.dd.timeseries.seasonal_fit import fit_velocity_seasonal, decimal_year


def _make_synthetic_series(
    n_epochs: int = 40,
    velocity: float = -20.0,    # mm/yr
    seasonal_amp: float = 5.0,  # mm
    noise_std: float = 0.5,     # mm
    seed: int = 42,
) -> tuple[list[str], np.ndarray]:
    """Create a synthetic time series with known velocity and seasonal amplitude."""
    from datetime import date, timedelta
    rng = np.random.default_rng(seed)

    start = date(2020, 1, 5)
    dates = [str(start + timedelta(days=12 * i)) for i in range(n_epochs)]

    t = np.array([decimal_year(d) for d in dates])
    t_rel = t - t[0]

    disp = (
        velocity * t_rel
        + seasonal_amp * np.sin(2 * np.pi * t_rel)
        + rng.normal(0, noise_std, n_epochs)
    )
    return dates, disp


class TestSeasonalFit:

    def test_velocity_recovered(self):
        dates, disp = _make_synthetic_series(velocity=-20.0, seasonal_amp=5.0, noise_std=0.1)
        result = fit_velocity_seasonal(dates, disp)
        assert result["status"] == "ok"
        assert result["velocity_mm_yr"] == pytest.approx(-20.0, abs=0.5)

    def test_seasonal_amp_recovered(self):
        dates, disp = _make_synthetic_series(velocity=-15.0, seasonal_amp=8.0, noise_std=0.1)
        result = fit_velocity_seasonal(dates, disp)
        assert result["status"] == "ok"
        assert result["seasonal_amp_mm"] == pytest.approx(8.0, abs=0.5)

    def test_zero_velocity(self):
        dates, disp = _make_synthetic_series(velocity=0.0, seasonal_amp=3.0, noise_std=0.05)
        result = fit_velocity_seasonal(dates, disp)
        assert result["velocity_mm_yr"] == pytest.approx(0.0, abs=0.3)

    def test_zero_seasonal(self):
        dates, disp = _make_synthetic_series(velocity=-10.0, seasonal_amp=0.0, noise_std=0.05)
        result = fit_velocity_seasonal(dates, disp)
        assert result["seasonal_amp_mm"] == pytest.approx(0.0, abs=0.3)

    def test_too_few_epochs_returns_error(self):
        dates = ["2020-01-01", "2020-02-01", "2020-03-01"]
        disp = np.array([0.0, -1.0, -2.0])
        result = fit_velocity_seasonal(dates, disp)
        assert result["status"] != "ok"

    def test_sigma_provided(self):
        dates, disp = _make_synthetic_series(velocity=-25.0, seasonal_amp=6.0, noise_std=0.2)
        sigma = np.full(len(dates), 0.5)  # uniform uncertainty
        result = fit_velocity_seasonal(dates, disp, sigmas=sigma)
        assert result["status"] == "ok"
        assert result["velocity_mm_yr"] == pytest.approx(-25.0, abs=1.0)


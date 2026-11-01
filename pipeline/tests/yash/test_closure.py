"""
pipeline/tests/yash/test_closure.py

Acceptance test: injected closure error is detected.

Closure phase φ_AB + φ_BC - φ_AC should be ~0 for correct unwrapping.
Injecting a 2π offset into one interferogram creates a detectable residual.
"""

import numpy as np
import pytest

from pipeline.dd.qc.closure import check_closure, compute_closure_phase


def _make_consistent_phases(shape=(50, 50), seed=42):
    """
    Create three internally consistent unwrapped phase arrays for a triplet.
    φ_AC = φ_AB + φ_BC exactly → closure phase = 0.
    """
    rng = np.random.default_rng(seed)
    phi_ab = rng.uniform(-10, 10, shape).astype(np.float32)
    phi_bc = rng.uniform(-10, 10, shape).astype(np.float32)
    phi_ac = phi_ab + phi_bc   # perfect closure
    return phi_ab, phi_bc, phi_ac


class TestClosurePhase:

    def test_perfect_closure_passes(self):
        """Perfectly consistent phases should give mean|closure| ≈ 0."""
        phi_ab, phi_bc, phi_ac = _make_consistent_phases()
        result = check_closure(phi_ab, phi_bc, phi_ac, max_mean_abs_rad=1.0)
        assert result["ok"], f"Expected OK for perfect closure, got: {result}"
        assert result["mean_abs_closure_rad"] == pytest.approx(0.0, abs=1e-5)

    def test_injected_2pi_error_detected(self):
        """Injecting a 2π offset into φ_AC creates a detectable closure error."""
        phi_ab, phi_bc, phi_ac = _make_consistent_phases()
        # Inject 2π unwrapping error into all pixels (simulates a bad unwrapping)
        phi_ac_wrong = phi_ac + 2 * np.pi
        result = check_closure(phi_ab, phi_bc, phi_ac_wrong, max_mean_abs_rad=1.0)
        assert not result["ok"], "2π injection should be detected as high closure phase"
        assert result["mean_abs_closure_rad"] == pytest.approx(2 * np.pi, abs=0.01)

    def test_partial_injection_detected(self):
        """Injecting 2π into 50% of pixels should exceed the 1.0 rad threshold."""
        phi_ab, phi_bc, phi_ac = _make_consistent_phases()
        phi_ac_partial = phi_ac.copy()
        ny, nx = phi_ac.shape
        phi_ac_partial[:ny // 2, :] += 2 * np.pi
        result = check_closure(phi_ab, phi_bc, phi_ac_partial, max_mean_abs_rad=1.0)
        # Mean |closure| ~ π ≈ 3.14, well above 1.0
        assert not result["ok"]
        assert result["mean_abs_closure_rad"] > 1.0

    def test_small_noise_passes(self):
        """Small noise (< 0.5 rad) should pass the threshold."""
        rng = np.random.default_rng(0)
        phi_ab = rng.uniform(-5, 5, (50, 50)).astype(np.float32)
        phi_bc = rng.uniform(-5, 5, (50, 50)).astype(np.float32)
        phi_ac = phi_ab + phi_bc + rng.normal(0, 0.1, (50, 50)).astype(np.float32)
        result = check_closure(phi_ab, phi_bc, phi_ac, max_mean_abs_rad=1.0)
        assert result["ok"], f"Small noise should pass: {result}"

    def test_nodata_handled(self):
        """nodata pixels should be excluded from the closure calculation."""
        phi_ab, phi_bc, phi_ac = _make_consistent_phases()
        nodata = -9999.0
        # Set some pixels to nodata
        phi_ab[0, :] = nodata
        phi_bc[:, 0] = nodata
        result = check_closure(phi_ab, phi_bc, phi_ac, max_mean_abs_rad=1.0, nodata=nodata)
        assert result["ok"], "Nodata pixels should be excluded, rest should be clean"

    def test_all_nodata_returns_error(self):
        """All-nodata input should return ok=False with an informative reason."""
        shape = (10, 10)
        nodata = -9999.0
        phi = np.full(shape, nodata, dtype=np.float32)
        result = check_closure(phi, phi, phi, max_mean_abs_rad=1.0, nodata=nodata)
        assert not result["ok"]
        assert "no_valid" in result["reason"]


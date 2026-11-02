"""
pipeline/tests/yash/test_phase_roundtrip.py

Acceptance test: synthetic displacement → phase → back recovers original including sign.

Convention:
  phase = (4π / λ) × displacement   (LOS, +ve toward satellite → -ve phase change)
  displacement = -λ / (4π) × phase  (positive LOS = phase decreasing)

This tests that the sign convention is preserved round-trip.
"""

import numpy as np
import pytest

WAVELENGTH_S1 = 0.05546576  # Sentinel-1 C-band, metres


def displacement_to_phase(displacement_m: np.ndarray, wavelength_m: float) -> np.ndarray:
    """
    Convert LOS displacement (metres, +ve toward satellite) to unwrapped phase (radians).

    φ = -(4π / λ) × d
    Negative because motion toward satellite decreases range → decreasing phase.
    """
    return -(4 * np.pi / wavelength_m) * displacement_m


def phase_to_displacement(phase_rad: np.ndarray, wavelength_m: float) -> np.ndarray:
    """
    Convert unwrapped phase (radians) to LOS displacement (metres).

    d = -(λ / 4π) × φ
    """
    return -(wavelength_m / (4 * np.pi)) * phase_rad


class TestPhaseRoundtrip:

    def test_positive_displacement_roundtrip(self):
        """Positive displacement (toward satellite) round-trips correctly."""
        d_orig = np.array([0.0, 10.0, -5.0, 0.03])  # metres
        phase = displacement_to_phase(d_orig, WAVELENGTH_S1)
        d_recovered = phase_to_displacement(phase, WAVELENGTH_S1)
        np.testing.assert_allclose(d_recovered, d_orig, rtol=1e-6,
                                   err_msg="Round-trip failed: displacement → phase → displacement")

    def test_sign_convention(self):
        """Positive displacement toward satellite → negative phase change."""
        d = np.array([0.01])  # 1 cm toward satellite
        phase = displacement_to_phase(d, WAVELENGTH_S1)
        assert phase[0] < 0, (
            f"Expected negative phase for motion toward satellite, got {phase[0]:.4f} rad"
        )

    def test_subsidence_sign(self):
        """Negative displacement (away from satellite, i.e. subsidence) → positive phase."""
        d = np.array([-0.01])  # 1 cm subsidence (away from satellite)
        phase = displacement_to_phase(d, WAVELENGTH_S1)
        assert phase[0] > 0, (
            f"Expected positive phase for subsidence, got {phase[0]:.4f} rad"
        )

    def test_zero_displacement(self):
        """Zero displacement → zero phase."""
        d = np.array([0.0])
        phase = displacement_to_phase(d, WAVELENGTH_S1)
        assert phase[0] == pytest.approx(0.0), "Zero displacement should yield zero phase"

    def test_wavelength_dependence(self):
        """Result depends correctly on wavelength (NISAR L-band vs S-1 C-band)."""
        wavelength_nisar = 0.238403  # NISAR L-band, metres
        d = np.array([0.01])
        phase_s1 = displacement_to_phase(d, WAVELENGTH_S1)
        phase_nisar = displacement_to_phase(d, wavelength_nisar)
        # L-band phase should be smaller in magnitude (longer wavelength)
        assert abs(phase_nisar[0]) < abs(phase_s1[0]), (
            "L-band phase should be smaller magnitude than C-band for same displacement"
        )

    def test_synthetic_velocity_field(self):
        """Full synthetic subsidence bowl → phase → displacement → velocity recoverable."""
        # Create a 2D synthetic bowl
        y, x = np.mgrid[-50:51, -50:51]
        r2 = (x ** 2 + y ** 2)
        velocity_mm_yr = -30.0 * np.exp(-r2 / 500.0)  # mm/yr, LOS

        # One-year displacement in metres
        displacement_m = velocity_mm_yr / 1000.0

        phase = displacement_to_phase(displacement_m, WAVELENGTH_S1)
        recovered_m = phase_to_displacement(phase, WAVELENGTH_S1)
        recovered_mm_yr = recovered_m * 1000.0

        np.testing.assert_allclose(
            recovered_mm_yr, velocity_mm_yr, rtol=1e-5,
            err_msg="Synthetic velocity field round-trip failed",
        )


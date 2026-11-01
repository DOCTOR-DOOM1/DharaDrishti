"""
pipeline/tests/shivani/test_fixture.py

Tests for Shivani's Fixture Generator (D-1).
"""

import json
from pathlib import Path
import numpy as np
import pytest
import tifffile
import zarr

from pipeline.dd.fixtures.generator import generate_fixture, GRID_SHAPE, NODATA


@pytest.fixture(scope="module")
def fixture_data(tmp_path_factory):
    out_dir = tmp_path_factory.mktemp("fixture_test")
    res = generate_fixture(slug="delhi-ncr", dest_root=out_dir)
    return out_dir, res


class TestFixtureGenerator:

    def test_fixture_files_exist(self, fixture_data):
        out_dir, _ = fixture_data
        expected_files = [
            "velocity.tif",
            "velocity_sigma.tif",
            "coherence.tif",
            "seasonal_amp.tif",
            "timeseries.zarr",
            "interferograms.json",
            "meta.json",
            "cost.json"
        ]
        for f in expected_files:
            assert (out_dir / f).exists(), f"Missing expected fixture file: {f}"

    def test_meta_is_truthfully_synthetic(self, fixture_data):
        out_dir, _ = fixture_data
        with open(out_dir / "meta.json") as f:
            meta = json.load(f)
        assert meta["synthetic"] is True, "Fixture meta.json MUST have synthetic: true"
        assert meta["city"] == "delhi-ncr"
        assert meta["sensor"] == "Sentinel-1"

    def test_velocity_raster_properties(self, fixture_data):
        out_dir, _ = fixture_data
        vel = tifffile.imread(str(out_dir / "velocity.tif"))
        assert vel.shape == GRID_SHAPE
        assert vel.dtype == np.float32

        # Verify subsidence bowl is present (negative LOS rates)
        valid = vel[vel != NODATA]
        assert len(valid) > 0
        assert np.min(valid) < -20.0, "Should contain negative velocity subsidence bowl"

    def test_coherence_masking(self, fixture_data):
        out_dir, _ = fixture_data
        coh = tifffile.imread(str(out_dir / "coherence.tif"))
        valid = coh[coh != NODATA]
        assert np.all(valid >= 0.30), "Coherence values should be masked where < 0.3"

    def test_timeseries_zarr_structure(self, fixture_data):
        out_dir, _ = fixture_data
        z_root = zarr.open_group(str(out_dir / "timeseries.zarr"), mode="r")
        assert "disp" in z_root
        assert "sigma" in z_root

        disp = z_root["disp"]
        assert disp.shape[0] == 40  # 40 epochs
        assert disp.shape[1:] == GRID_SHAPE
        assert len(z_root.attrs["dates"]) == 40
        assert z_root.attrs["units"] == "mm"

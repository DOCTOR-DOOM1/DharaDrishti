"""
pipeline/tests/shivani/test_hotspots.py

Tests for Hotspot Extraction (D-3).
"""

import json
from pathlib import Path
import pytest

from pipeline.dd.fixtures.generator import generate_fixture
from pipeline.dd.derive.derive import compute_derived_layers


@pytest.fixture(scope="module")
def hotspots_output(tmp_path_factory):
    work_dir = tmp_path_factory.mktemp("hotspots_test")
    generate_fixture(dest_root=work_dir)
    res = compute_derived_layers(work_dir)
    with open(work_dir / "hotspots.geojson") as f:
        data = json.load(f)
    return data


class TestHotspots:

    def test_hotspots_detected(self, hotspots_output):
        features = hotspots_output["features"]
        assert len(features) >= 1, "Should detect at least 1 significant subsidence hotspot"

    def test_hotspot_properties_contract(self, hotspots_output):
        for feat in hotspots_output["features"]:
            props = feat["properties"]
            assert "id" in props
            assert "mean_rate" in props
            assert "max_rate" in props
            assert "rate_sigma" in props
            assert "area_km2" in props
            assert "snr" in props

            # Check that subsidence is negative LOS velocity
            assert props["mean_rate"] < 0
            assert props["max_rate"] <= props["mean_rate"]
            assert props["snr"] >= 3.0  # Must meet threshold
            assert props["area_km2"] > 0.0

    def test_hotspot_geometry_valid(self, hotspots_output):
        for feat in hotspots_output["features"]:
            geom = feat["geometry"]
            assert geom["type"] == "MultiPolygon"
            coords = geom["coordinates"]
            assert len(coords) > 0
            # Outer ring closed
            ring = coords[0][0]
            assert ring[0] == ring[-1], "Polygon outer ring must be closed"

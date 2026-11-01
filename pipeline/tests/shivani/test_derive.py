"""
pipeline/tests/shivani/test_derive.py

Tests for Derived Science Calculations (D-2, D-4).
"""

import json
from pathlib import Path
import numpy as np
import pytest
import tifffile

from pipeline.dd.fixtures.generator import generate_fixture, NODATA, GRID_SHAPE
from pipeline.dd.derive.derive import compute_derived_layers


@pytest.fixture(scope="module")
def derived_output(tmp_path_factory):
    work_dir = tmp_path_factory.mktemp("derive_test")
    generate_fixture(dest_root=work_dir)
    res = compute_derived_layers(work_dir)
    return work_dir, res


class TestDeriveLayers:

    def test_gradient_raster(self, derived_output):
        work_dir, _ = derived_output
        grad_file = work_dir / "gradient.tif"
        assert grad_file.exists()

        grad = tifffile.imread(str(grad_file))
        assert grad.shape == GRID_SHAPE
        valid = grad[grad != NODATA]
        assert len(valid) > 0
        assert np.all(valid >= 0.0), "Gradient magnitudes must be non-negative"
        # Peak gradient at subsidence bowl edge
        assert np.max(valid) > 5.0, "Expected significant gradient around subsidence bowl"

    def test_detection_confidence(self, derived_output):
        work_dir, _ = derived_output
        conf_file = work_dir / "detection_conf.tif"
        assert conf_file.exists()

        conf = tifffile.imread(str(conf_file))
        valid = conf[conf != NODATA]
        assert len(valid) > 0
        assert np.all(valid >= 0.0)

        # High SNR in deep subsidence zones
        assert np.max(valid) >= 5.0

    def test_summary_json(self, derived_output):
        work_dir, _ = derived_output
        sum_file = work_dir / "summary.json"
        assert sum_file.exists()

        with open(sum_file) as f:
            summary = json.load(f)

        assert "noise_floor_mm_yr" in summary
        assert "fastest_rate" in summary
        assert summary["fastest_rate"]["value"] < -20.0
        assert "significance_multiple" in summary
        assert summary["significance_multiple"] == 3.0
        assert summary["coverage_pct"] > 50.0

    def test_risk_zones_schema(self, derived_output):
        work_dir, _ = derived_output
        risk_file = work_dir / "risk_zones.geojson"
        assert risk_file.exists()

        with open(risk_file) as f:
            risk_data = json.load(f)

        assert risk_data["type"] == "FeatureCollection"
        for feat in risk_data["features"]:
            props = feat["properties"]
            assert props["kind"] == "risk_heuristic", "Contract: every risk feature must carry kind: risk_heuristic"
            assert "risk_index" in props
            assert 0.0 <= props["risk_index"] <= 1.0
            assert "inputs" in props

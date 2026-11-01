"""
pipeline/tests/yash/test_planning.py

Tests for pair planning and credit estimation.
"""

import pytest
from pipeline.dd.planning.network import plan_pairs
from pipeline.dd.planning.credits import credits_per_pair, estimate_total, check_budget


class TestPairPlanning:

    def test_sequential_pairs(self):
        dates = ["2021-01-01", "2021-01-12", "2021-01-24", "2021-02-05", "2021-05-01"]
        pairs = plan_pairs(dates, max_temporal_days=48, yearly=False)
        # 01 → 12 ✓, 01 → 24 ✓, 01 → 05Feb ✓, 12 → 24 ✓, 12 → 05Feb ✓,
        # 24 → 05Feb ✓, 05Feb → 01May = 85d > 48 ✗
        for ref, sec in pairs:
            from datetime import date
            delta = (date.fromisoformat(sec) - date.fromisoformat(ref)).days
            assert delta <= 48, f"Pair {ref}→{sec} exceeds max_temporal_days"

    def test_yearly_bridges(self):
        dates = ["2020-01-05", "2021-01-06", "2022-01-07"]
        pairs = plan_pairs(dates, max_temporal_days=20, yearly=True)
        pair_strs = [(r, s) for r, s in pairs]
        # 2020-01-05 → 2021-01-06 = 366 days → in window [350,380] → should be included
        assert ("2020-01-05", "2021-01-06") in pair_strs

    def test_existing_keys_skipped(self):
        dates = ["2021-01-01", "2021-01-12"]
        # Pre-populate the store with the only possible pair
        key = "Sentinel-1_ascending_2021-01-01_2021-01-12__20x4_hyp3-isce2_unknown"
        pairs = plan_pairs(
            dates,
            existing_keys={key},
            sensor="Sentinel-1",
            direction="ascending",
            looks="20x4",
        )
        assert len(pairs) == 0, "All pairs should be skipped as they already exist"

    def test_no_duplicates(self):
        dates = ["2021-01-01", "2021-01-12", "2021-01-24"]
        pairs = plan_pairs(dates)
        # No duplicate pairs
        assert len(pairs) == len(set(pairs))


class TestCredits:

    def test_1_burst_80m(self):
        assert credits_per_pair("20x4", 1) == 1

    def test_4_bursts_80m(self):
        assert credits_per_pair("20x4", 4) == 1

    def test_5_bursts_80m(self):
        assert credits_per_pair("20x4", 5) == 5

    def test_40m_costs_more(self):
        cost_80m = credits_per_pair("20x4", 8)
        cost_40m = credits_per_pair("10x2", 8)
        assert cost_40m > cost_80m

    def test_estimate_total_with_safety(self):
        total = estimate_total(10, "20x4", n_bursts=8, safety_factor=1.0)
        assert total == 50   # 10 pairs × 5 credits each

    def test_budget_ok(self):
        result = check_budget(100.0, 500.0)
        assert result["ok"] is True
        assert result["remaining"] == 500.0

    def test_budget_exceeded(self):
        result = check_budget(600.0, 500.0)
        assert result["ok"] is False
        assert result["shortfall"] == pytest.approx(100.0)


"""
pipeline/dd/planning/credits.py

HyP3 credit estimation utilities.

Credit schedule (HyP3 burst InSAR, 2024):
  - 1–4 bursts at 80 m (20x4 looks): 1 credit/pair
  - 5–12 bursts at 80 m:             5 credits/pair
  - 40 m (10x2 looks) adds ~5×
  - 20 m (5x1 looks) adds ~20×

Hard cap: budget.max_credits_per_month from city config.
"""

from __future__ import annotations

import math


# Table: (looks, min_bursts, max_bursts) → credits
_SCHEDULE: list[tuple[str, int, int, int]] = [
    ("20x4", 1, 4, 1),
    ("20x4", 5, 12, 5),
    ("10x2", 1, 4, 5),
    ("10x2", 5, 12, 10),
    ("5x1",  1, 4, 20),
    ("5x1",  5, 12, 40),
]


def credits_per_pair(looks: str, n_bursts: int) -> int:
    """Return the number of credits for one interferogram."""
    for lks, lo, hi, cost in _SCHEDULE:
        if lks == looks and lo <= n_bursts <= hi:
            return cost
    # Default fallback: most expensive
    return 40


def estimate_total(
    n_pairs: int,
    looks: str,
    *,
    n_bursts: int = 8,
    safety_factor: float = 1.1,
) -> float:
    """
    Estimate total credits for a batch.

    Parameters
    ----------
    n_pairs : number of interferogram pairs
    looks : HyP3 looks string ("20x4", "10x2", "5x1")
    n_bursts : burst count per pair (default 8 = conservative)
    safety_factor : multiplier for budget reserve
    """
    per_pair = credits_per_pair(looks, n_bursts)
    return math.ceil(n_pairs * per_pair * safety_factor)


def check_budget(
    estimated: float,
    monthly_cap: float,
    used_this_month: float = 0.0,
) -> dict:
    """
    Check if the estimated spend fits within the monthly cap.

    Returns dict with keys: ok, remaining, shortfall.
    """
    remaining = monthly_cap - used_this_month
    ok = estimated <= remaining
    return {
        "ok": ok,
        "estimated": estimated,
        "remaining": remaining,
        "shortfall": max(0.0, estimated - remaining),
    }


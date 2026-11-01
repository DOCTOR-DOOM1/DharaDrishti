"""
pipeline/dd/planning/network.py

Interferogram network planning for SBAS.

Rules:
  - Sequential: each date → next 3 neighbours within max_temporal_days (default 48)
  - Yearly bridges: each date → date ~365 days later (±15 days)
  - Never re-plan a pair whose immutable key already exists in the store
"""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
from typing import Optional
import json


def plan_pairs(
    dates: list[str],
    *,
    max_temporal_days: int = 48,
    max_neighbours: int = 3,
    yearly: bool = True,
    yearly_window_days: int = 15,
    existing_keys: Optional[set[str]] = None,
    sensor: str = "Sentinel-1",
    direction: str = "ascending",
    burst_ids: list[str] = None,
    looks: str = "20x4",
    processor: str = "hyp3-isce2",
    processor_version: str = "unknown",
) -> list[tuple[str, str]]:
    """
    Plan interferogram pairs from a list of acquisition dates.

    Parameters
    ----------
    dates : list of ISO-8601 date strings
    max_temporal_days : sequential baseline cutoff
    max_neighbours : maximum sequential neighbours per date
    yearly : add ~1-year bridges
    yearly_window_days : tolerance around 365 days for yearly pairs
    existing_keys : immutable keys already in the store (skip these)
    sensor, direction, burst_ids, looks, processor, processor_version :
        used to compute immutable keys for deduplication

    Returns
    -------
    list of (ref_date, sec_date) pairs (new only, sorted)
    """
    if existing_keys is None:
        existing_keys = set()
    if burst_ids is None:
        burst_ids = []

    date_objs = sorted({date.fromisoformat(d) for d in dates})
    pairs: set[tuple[str, str]] = set()

    for i, ref in enumerate(date_objs):
        neighbours = 0
        for sec in date_objs[i + 1:]:
            delta = (sec - ref).days
            if delta > max_temporal_days:
                break
            pairs.add((str(ref), str(sec)))
            neighbours += 1
            if neighbours >= max_neighbours:
                break

    if yearly:
        for i, ref in enumerate(date_objs):
            for sec in date_objs[i + 1:]:
                delta = (sec - ref).days
                if abs(delta - 365) <= yearly_window_days:
                    pairs.add((str(ref), str(sec)))

    # Filter out already-stored pairs
    def _key(ref: str, sec: str) -> str:
        burst_str = "_".join(sorted(burst_ids))
        return (
            f"{sensor}_{direction}_{ref}_{sec}"
            f"_{burst_str}_{looks}_{processor}_{processor_version}"
        )

    new_pairs = [
        (ref, sec) for ref, sec in sorted(pairs)
        if _key(ref, sec) not in existing_keys
    ]
    return new_pairs


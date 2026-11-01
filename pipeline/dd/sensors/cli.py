"""
pipeline/dd/sensors/cli.py

Sensors CLI sub-commands (auto-discovered by dd/cli.py).
Exposed as: dd acquisitions report <slug>
"""

from __future__ import annotations

import json
import logging
from datetime import date, timedelta
from pathlib import Path

import click
import yaml

from pipeline.dd.config import CITIES_DIR, REPO_ROOT, load_city_config
from pipeline.dd.sensors.sentinel1_hyp3 import Sentinel1HyP3Adapter

log = logging.getLogger(__name__)


@click.group("acquisitions")
def command():
    """Sentinel-1 acquisition utilities."""


@command.command("report")
@click.argument("slug")
@click.option("--start", default="2020-01-01", help="Search start date (YYYY-MM-DD)")
@click.option("--end", default=None, help="Search end date (default: today)")
@click.option("--output", default=None, help="Output markdown file (default: docs/acquisitions.md)")
def acquisitions_report(slug: str, start: str, end: str, output: str):
    """
    Count and report Sentinel-1 acquisitions for a city.

    Writes docs/acquisitions.md with per-year × track × direction counts.
    Does NOT assume 6-day cadence — it counts real scenes from ASF.
    """
    cfg = load_city_config(slug)
    aoi_wkt = cfg.get("aoi_wkt") or _bbox_to_wkt(cfg["aoi"])

    if end is None:
        end = str(date.today())

    click.echo(f"Searching ASF for {slug} ({start} → {end}) …")

    adapter = Sentinel1HyP3Adapter()
    try:
        scenes = adapter.search(aoi_wkt, start, end)
    except Exception as exc:
        click.echo(f"[ERROR] ASF search failed: {exc}", err=True)
        click.echo("Writing placeholder acquisitions.md.", err=True)
        scenes = []

    # Aggregate: year × track × direction
    stats: dict[str, dict[str, dict[str, int]]] = {}
    for s in scenes:
        yr = s["date"][:4]
        tr = s["track"]
        di = s["direction"]
        stats.setdefault(yr, {}).setdefault(tr, {}).setdefault(di, 0)
        stats[yr][tr][di] += 1

    # Pick best track/direction
    best_track, best_dir, best_count = _pick_best(scenes)

    # Build markdown
    lines = [
        f"# Sentinel-1 Acquisitions — {slug}",
        "",
        f"**Search period:** {start} → {end}  ",
        f"**Total scenes found:** {len(scenes)}  ",
        f"**Best track/direction:** {best_track} / {best_dir} ({best_count} scenes)  ",
        "",
        "## Per-year breakdown",
        "",
        "| Year | Track | Direction | Scenes |",
        "|------|-------|-----------|--------|",
    ]
    for yr in sorted(stats):
        for tr in sorted(stats[yr]):
            for di in sorted(stats[yr][tr]):
                cnt = stats[yr][tr][di]
                lines.append(f"| {yr} | {tr} | {di} | {cnt} |")

    lines += [
        "",
        "## Notes",
        "- Counts are from a live ASF search — not assumed 6-day cadence.",
        "- Track selection is based on scene count; refine with coverage check.",
        "",
        "## NISAR Coverage",
        "- Check NISAR observation plan at https://nisar.jpl.nasa.gov/mission/coverage/",
        "  for AOI coverage (instrument mode, repeat cycle, expected first data).",
        "- LiCSAR frame check: https://comet.nerc.ac.uk/COMET-LiCS-portal/",
    ]

    md = "\n".join(lines) + "\n"

    out_path = Path(output) if output else REPO_ROOT / "docs" / "acquisitions.md"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(md, encoding="utf-8")
    click.echo(f"Written: {out_path}")


def _bbox_to_wkt(aoi: dict) -> str:
    w, s, e, n = aoi["west"], aoi["south"], aoi["east"], aoi["north"]
    return f"POLYGON(({w} {s},{e} {s},{e} {n},{w} {n},{w} {s}))"


def _pick_best(scenes: list[dict]) -> tuple[str, str, int]:
    from collections import Counter
    counter: Counter = Counter()
    for s in scenes:
        counter[(s["track"], s["direction"])] += 1
    if not counter:
        return ("unknown", "unknown", 0)
    (track, direction), count = counter.most_common(1)[0]
    return (track, direction, count)


"""
pipeline/dd/planning/cli.py

Planning CLI sub-commands (auto-discovered by dd/cli.py).
Exposed as: dd plan [--dry-run] <slug>
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import click

from pipeline.dd.config import load_city_config, interferograms_dir
from pipeline.dd.planning.network import plan_pairs
from pipeline.dd.planning.credits import estimate_total, check_budget
from pipeline.dd.sensors.sentinel1_hyp3 import Sentinel1HyP3Adapter

log = logging.getLogger(__name__)


@click.group("plan")
def command():
    """Interferogram network planning."""


@command.command("run")
@click.argument("slug")
@click.option("--dry-run", is_flag=True, default=False, help="Print pairs but do not submit")
@click.option("--start", default="2020-01-01")
@click.option("--end", default=None)
@click.option("--looks", default=None, help="Looks (default from city config)")
def plan_run(slug: str, dry_run: bool, start: str, end: str, looks: str):
    """
    Plan interferogram pairs for a city.

    In dry-run mode: prints planned pairs, credit estimate, and budget check.
    Otherwise: stores the plan in <interferograms_dir>/plan.json.
    """
    from datetime import date as _date
    cfg = load_city_config(slug)
    hyp3_cfg = cfg.get("hyp3", {})

    _looks = looks or hyp3_cfg.get("looks", "20x4")
    monthly_cap = cfg.get("budget", {}).get("max_credits_per_month", 500)
    _end = end or str(_date.today())

    aoi = cfg.get("aoi", {})
    aoi_wkt = cfg.get("aoi_wkt") or (
        f"POLYGON(({aoi['west']} {aoi['south']},"
        f"{aoi['east']} {aoi['south']},"
        f"{aoi['east']} {aoi['north']},"
        f"{aoi['west']} {aoi['north']},"
        f"{aoi['west']} {aoi['south']}))"
    )

    # Search for scenes
    click.echo(f"Searching acquisitions for {slug} …")
    adapter = Sentinel1HyP3Adapter()
    try:
        scenes = adapter.search(
            aoi_wkt, start, _end,
            direction=cfg.get("direction"),
            track=str(cfg.get("track", "")),
        )
    except Exception as exc:
        click.echo(f"[ERROR] {exc}", err=True)
        return

    dates = [s["date"] for s in scenes]
    if not dates:
        click.echo("No scenes found — check AOI and date range.", err=True)
        return

    # Load existing keys to skip
    idir = interferograms_dir(slug)
    existing_keys: set[str] = set()
    store_index = idir / "store_index.json"
    if store_index.exists():
        with store_index.open() as fh:
            existing_keys = set(json.load(fh).get("keys", []))

    pairs = plan_pairs(
        dates,
        max_temporal_days=hyp3_cfg.get("max_temporal_days", 48),
        existing_keys=existing_keys,
        looks=_looks,
        direction=cfg.get("direction", "ascending"),
    )

    est = estimate_total(len(pairs), _looks, n_bursts=hyp3_cfg.get("n_bursts", 8))
    budget_check = check_budget(est, monthly_cap)

    click.echo(f"\n{'DRY RUN — ' if dry_run else ''}Plan for {slug}")
    click.echo(f"  Scenes found:      {len(scenes)}")
    click.echo(f"  New pairs planned: {len(pairs)}")
    click.echo(f"  Looks:             {_looks}")
    click.echo(f"  Estimated credits: {est}")
    click.echo(f"  Monthly cap:       {monthly_cap}")
    click.echo(f"  Budget OK:         {'✅' if budget_check['ok'] else '❌'}")
    if not budget_check["ok"]:
        click.echo(f"  Shortfall:         {budget_check['shortfall']:.0f} credits")

    if dry_run:
        click.echo("\nPairs (ref → sec):")
        for ref, sec in pairs[:20]:
            click.echo(f"  {ref} → {sec}")
        if len(pairs) > 20:
            click.echo(f"  … and {len(pairs) - 20} more")
        return

    # Save plan
    idir.mkdir(parents=True, exist_ok=True)
    plan_path = idir / "plan.json"
    plan_data = {
        "slug": slug,
        "looks": _looks,
        "pairs": [{"ref": r, "sec": s} for r, s in pairs],
        "estimated_credits": est,
        "budget_ok": budget_check["ok"],
    }
    with plan_path.open("w") as fh:
        json.dump(plan_data, fh, indent=2)
    click.echo(f"\nPlan saved → {plan_path}")


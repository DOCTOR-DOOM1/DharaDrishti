"""
pipeline/dd/derive/cli.py

Auto-discovered by dd/cli.py.
Exposed as: dd derive run <slug> [--source fixture|real]
"""

import click
from pathlib import Path
from pipeline.dd.derive.derive import compute_derived_layers


@click.group("derive")
def command():
    """Derived science layer processing (Shivani's Track)."""


@command.command("run")
@click.argument("slug", default="delhi-ncr")
@click.option("--source", type=click.Choice(["fixture", "real"]), default="fixture",
              help="Whether to process data/fixture/ or data/products/")
@click.option("--version", default=1, type=int, help="Product version")
def derive_run(slug: str, source: str, version: int):
    """
    Compute gradient.tif, detection_conf.tif, hotspots.geojson,
    risk_zones.geojson, alerts.geojson, and summary.json.
    """
    if source == "fixture":
        target_dir = Path("d:/DharaDrishti/data/fixture") / slug / f"v{version}"
    else:
        target_dir = Path("d:/DharaDrishti/data/products") / slug / f"v{version}"

    if not target_dir.exists():
        click.echo(f"[ERROR] Directory not found: {target_dir}", err=True)
        return

    click.echo(f"Running derive on {source} ({target_dir})...")
    res = compute_derived_layers(target_dir, slug=slug)
    click.echo(f"Derived layers successfully computed:")
    click.echo(f"  Gradient:       {res['gradient']}")
    click.echo(f"  Confidence:     {res['detection_conf']}")
    click.echo(f"  Hotspots:       {res['hotspots_count']} clusters")
    click.echo(f"  Noise floor:    {res['summary']['noise_floor_mm_yr']} mm/yr")
    click.echo(f"  Hotspot area:   {res['summary']['hotspot_area_km2']} km²")

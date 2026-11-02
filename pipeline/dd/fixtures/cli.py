"""
pipeline/dd/fixtures/cli.py

Auto-discovered by dd/cli.py.
Exposed as: dd fixture generate [slug]
"""

import click
from pathlib import Path
from pipeline.dd.fixtures.generator import generate_fixture
from pipeline.dd.derive.derive import compute_derived_layers


@click.group("fixture")
def command():
    """Synthetic Fixture Generator (Shivani's Track)."""


@command.command("generate")
@click.argument("slug", default="delhi-ncr")
@click.option("--out-dir", default=None, help="Custom output directory")
def fixture_generate(slug: str, out_dir: str):
    """
    Generate complete synthetic dataset for fixture/<slug>/v1/
    and run derive to produce the full contract bundle.
    """
    click.echo(f"Generating synthetic fixture for {slug}...")
    dest_path = Path(out_dir) if out_dir else None
    res = generate_fixture(slug=slug, dest_root=dest_path)
    click.echo(f"Base rasters & Zarr generated in: {res['dest']}")

    click.echo("Running science derivation on fixture...")
    fixture_dir = Path(res["dest"])
    derive_res = compute_derived_layers(fixture_dir, slug=slug)
    click.echo(f"Derived layers complete! Hotspots detected: {derive_res['hotspots_count']}")
    click.echo(f"Summary: Fastest={derive_res['summary']['fastest_rate']['value']} mm/yr, Coverage={derive_res['summary']['coverage_pct']}%")
    click.echo("Fixture delivery H3 (Sync 1) READY.")


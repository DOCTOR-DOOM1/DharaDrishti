"""
pipeline/dd/publish/cli.py

Publish CLI sub-commands (auto-discovered by dd/cli.py).
Exposed as: dd publish <slug>
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import click

from pipeline.dd.config import load_city_config, products_dir
from pipeline.dd.publish.export import publish_products

log = logging.getLogger(__name__)


@click.group("publish")
def command():
    """Export pipeline products (files only — no DB/MinIO loading)."""


@command.command("run")
@click.argument("slug")
@click.option("--version", default=1, type=int, help="Product version")
@click.option("--mintpy-dir", default=None, help="MintPy working directory")
@click.option("--force", is_flag=True, default=False, help="Overwrite existing files")
@click.option("--synthetic", is_flag=True, default=False,
              help="Mark products as synthetic (meta.json synthetic:true)")
def publish_run(slug: str, version: int, mintpy_dir: str, force: bool, synthetic: bool):
    """
    Export MintPy products to data/products/<slug>/v<version>/.

    Writes COGs, Zarr, snapshots, meta.json, interferograms.json, cost.json.
    Does NOT load anything to MinIO or Postgres — that is Saksham's job.
    """
    cfg = load_city_config(slug)

    from pipeline.dd.config import REPO_ROOT
    if mintpy_dir:
        work_dir = Path(mintpy_dir)
    else:
        work_dir = REPO_ROOT / "data" / "mintpy" / slug

    if not work_dir.exists():
        click.echo(f"[ERROR] MintPy working directory not found: {work_dir}", err=True)
        click.echo("Run `dd invert <slug>` first.", err=True)
        return

    # Load interferogram metadata if present
    ifg_meta_path = work_dir / "interferograms_meta.json"
    ifg_meta = None
    if ifg_meta_path.exists():
        with ifg_meta_path.open() as fh:
            ifg_meta = json.load(fh)

    # Load cost data if present
    cost_path = work_dir / "cost_raw.json"
    cost_data = None
    if cost_path.exists():
        with cost_path.open() as fh:
            cost_data = json.load(fh)

    click.echo(f"Publishing products for {slug} v{version} from {work_dir} …")

    written = publish_products(
        slug=slug,
        version=version,
        mintpy_work_dir=work_dir,
        city_config=cfg,
        interferograms_meta=ifg_meta,
        cost_data=cost_data,
        synthetic=synthetic,
        force=force,
    )

    out = products_dir(slug, version)
    click.echo(f"\nProducts written to: {out}")
    for name, path in written.items():
        click.echo(f"  ✓ {name}")


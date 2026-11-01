"""
pipeline/dd/validate/cli.py

Auto-discovered by dd/cli.py.
Exposed as: dd validate run <slug> [--source fixture|real]
"""

import click
from pathlib import Path
from pipeline.dd.validate.validator import validate_against_references


@click.group("validate")
def command():
    """Validation against published literature (Shivani's Track)."""


@command.command("run")
@click.argument("slug", default="delhi-ncr")
@click.option("--source", type=click.Choice(["fixture", "real"]), default="fixture")
@click.option("--version", default=1, type=int)
def validate_run(slug: str, source: str, version: int):
    """
    Compare computed velocity fields with published literature.
    """
    if source == "fixture":
        target_dir = Path("d:/DharaDrishti/data/fixture") / slug / f"v{version}"
    else:
        target_dir = Path("d:/DharaDrishti/data/products") / slug / f"v{version}"

    if not target_dir.exists():
        click.echo(f"[ERROR] Directory not found: {target_dir}", err=True)
        return

    click.echo(f"Validating {slug} ({source})...")
    res = validate_against_references(target_dir, slug=slug)

    click.echo("\n--- Published Literature Comparison ---")
    for item in res["comparisons"]:
        click.echo(f"\nSite: {item['area_name']} ({item['citation']})")
        click.echo(f"  Published: {item['published_rate']} mm/yr ({item['published_basis']}, {item['period_published']})")
        click.echo(f"  Ours:      {item['our_rate']} ± {item['our_sigma']} mm/yr")
        click.echo(f"  Delta:     {item['difference']} mm/yr")
        click.echo(f"  Note:      {item['notes']}")


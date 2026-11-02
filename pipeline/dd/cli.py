"""
DharaDrishti pipeline — top-level CLI.

Auto-discovers any dd/<package>/cli.py that exposes a `command` attribute
(a Click command or group). This means Shivani's derive/cli.py, validate/cli.py
and fixtures/cli.py are picked up automatically without editing this file.

Usage:
    dd city init <slug>
    dd acquisitions report <slug>
    dd plan [--dry-run] <slug>
    dd ingest <slug>
    dd invert <slug>
    dd publish <slug>
    dd update <slug>
"""

import importlib
import importlib.util
import pkgutil
import sys
from pathlib import Path

import click

# ---------------------------------------------------------------------------
# Core command groups owned by Yash
# ---------------------------------------------------------------------------
from pipeline.dd.planning.cli import command as planning_command  # noqa: E402
from pipeline.dd.sensors.cli import command as sensors_command    # noqa: E402

DD_PACKAGE_ROOT = Path(__file__).parent


def _autodiscover_commands():
    """Return list of (name, Click command) from all dd/<pkg>/cli.py files."""
    commands = []
    for item in DD_PACKAGE_ROOT.iterdir():
        if not item.is_dir():
            continue
        cli_path = item / "cli.py"
        if not cli_path.exists():
            continue
        module_name = f"pipeline.dd.{item.name}.cli"
        spec = importlib.util.spec_from_file_location(module_name, cli_path)
        if spec is None:
            continue
        mod = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(mod)
        except Exception as exc:
            click.echo(f"[warn] Could not load {cli_path}: {exc}", err=True)
            continue
        cmd = getattr(mod, "command", None)
        if cmd is not None and isinstance(cmd, click.BaseCommand):
            commands.append((item.name, cmd))
    return commands


@click.group()
def cli():
    """DharaDrishti pipeline CLI."""


# Register Yash's static commands
cli.add_command(planning_command, name="plan")
cli.add_command(sensors_command, name="acquisitions")

# Auto-discover and register extra commands from other packages
for _pkg_name, _cmd in _autodiscover_commands():
    # Skip packages already registered above
    if _pkg_name not in ("planning", "sensors"):
        cli.add_command(_cmd, name=_pkg_name)


if __name__ == "__main__":
    cli()


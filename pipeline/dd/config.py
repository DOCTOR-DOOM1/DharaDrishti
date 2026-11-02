"""
DharaDrishti pipeline — shared config loader.

Reads cities/<slug>.yaml for pipeline parameters.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

# Repo root (two levels up from pipeline/dd/)
REPO_ROOT = Path(__file__).parent.parent.parent
CITIES_DIR = REPO_ROOT / "cities"
DATA_DIR = REPO_ROOT / "data"


def load_city_config(slug: str) -> dict[str, Any]:
    """Load and return the city YAML config for *slug*."""
    path = CITIES_DIR / f"{slug}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"City config not found: {path}")
    with path.open() as fh:
        return yaml.safe_load(fh)


def products_dir(slug: str, version: int = 1) -> Path:
    return DATA_DIR / "products" / slug / f"v{version}"


def raw_dir(slug: str) -> Path:
    return DATA_DIR / "raw" / slug


def interferograms_dir(slug: str) -> Path:
    return DATA_DIR / "interferograms" / slug


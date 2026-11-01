# DharaDrishti 🌍

**Land Subsidence Mapping — EYICPS#50**

> InSAR-based land subsidence monitoring platform for Indian cities, built with scientific honesty as a first principle.

## Team

| Person | Track |
|--------|-------|
| **Yash** | Pipeline & SAR data (measurement) + SAR-data views |
| **Sohan** | Frontend (map app, layers, charts, view shell) |
| **Saksham** | API, database, tiles, jobs, infra, repo & CI |
| **Shivani** | Derived science, fixture, validation, demo + science views |

## Quick Start

### Prerequisites
- Docker & Docker Compose v2
- GNU Make (or equivalent)
- Git

### One-command setup

```bash
# 1. Clone and configure
git clone <repo-url> && cd DharaDrishti
cp .env.example .env

# 2. Start all services
make up

# 3. Seed with fixture data
make seed SOURCE=fixture

# 4. Verify
curl http://localhost:8000/health
# → {"status": "ok"}
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| **API** | `8000` | FastAPI REST API |
| **TiTiler** | `8001` | Cloud-Optimized GeoTIFF tile server |
| **Web** | `5173` | React + MapLibre frontend |
| **MinIO** | `9000` / `9001` | S3-compatible object storage |
| **Postgres** | `5432` | PostGIS database |
| **Redis** | `6379` | Cache + job queue |

### Make Targets

```bash
make up        # Start all services
make down      # Stop all services
make seed      # Load data (SOURCE=fixture|real)
make test      # Run all tests
make demo      # Full demo pipeline
make lint      # Lint all code
make clean     # Remove volumes and containers
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full system design.

### Key Principles
1. **Only interferometric phase → displacement is a measurement.** No DEM-based subsidence claims.
2. **Three layer types, never mixed:** `measured`, `derived`, `risk` (heuristic).
3. **Line-of-sight velocity**, relative to a reference point, positive = toward satellite.
4. **Low-coherence pixels are masked**, never interpolated.
5. **No processing at request time** — the API reads stored products only.
6. **Synthetic data always labelled** with `"synthetic": true` and a persistent banner.

## Project Structure

```
DharaDrishti/
├── api/                  # FastAPI backend (Saksham)
│   ├── app/              # Application code
│   ├── migrations/       # Alembic database migrations
│   └── tests/            # API tests
├── worker/               # RQ job workers (Saksham)
├── reports/templates/    # PDF report templates (Saksham)
├── pipeline/dd/          # Processing pipeline
│   ├── sensors/          # Sensor adapters (Yash)
│   ├── planning/         # Acquisition planning (Yash)
│   ├── qc/               # Quality control (Yash)
│   ├── timeseries/       # Time series analysis (Yash)
│   ├── publish/          # Export products (Yash)
│   ├── derive/           # Derived layers (Shivani)
│   ├── validate/         # Validation (Shivani)
│   └── fixtures/         # Fixture generator (Shivani)
├── web/                  # React frontend (Sohan)
│   └── src/
│       ├── views-sar/    # SAR data views (Yash)
│       └── views-science/# Science views (Shivani)
├── cities/               # City configs (Yash + Shivani)
├── data/                 # Data directory (not committed)
├── docs/                 # Documentation
├── infra/                # Infrastructure scripts (Saksham)
└── .github/workflows/    # CI/CD (Saksham)
```

## API Documentation

Once running, visit: `http://localhost:8000/docs` (Swagger UI)

See the full endpoint contract in [docs/product-contract.md](docs/product-contract.md).

## Branches

| Branch | Owner |
|--------|-------|
| `main` | Protected — merged by Saksham |
| `yash/pipeline` | Yash |
| `sohan/frontend` | Sohan |
| `saksham/backend` | Saksham |
| `shivani/science` | Shivani |

## License

Internal project — EYICPS#50, e-Yantra.

# DharaDrishti: Shared Product Contract

> **Author:** Shivani  
> **Source:** Architecture Document & Zero-Overlap Team Plan (Sections 3 & 4)  
> **Status:** FROZEN at Hour 0. Changes require agreement from Yash, Sohan, Saksham, and Shivani.

---

## 3. Shared Contract (FROZEN at Hour 0)

### 3.1 Non-negotiable rules
1. **Only interferometric phase converted to displacement is a measurement.** Never claim subsidence from DEM or elevation differences.
2. **Three layers, never mixed:** `measured` (velocity, sigma, coherence, time series, seasonal amplitude), `derived` (gradient, hotspots, detection confidence, alerts), `risk` (heuristic). The risk layer is **off by default**, has its own colour scale, and always carries **"Screening index, not a prediction of damage."**
3. Velocity is **line-of-sight (LOS), relative to a reference point, positive = toward satellite** (MintPy convention). LOS is never silently called vertical.
4. Low-coherence pixels are masked. The API says "no reliable measurement" and **never interpolates**.
5. **No processing at request time.** The API reads stored products only.
6. Synthetic data always has `"synthetic": true` and shows the banner **"SYNTHETIC TEST DATA, not a measurement"**.
7. **No accuracy figures** until measured. Disagreement with published studies is reported, never tuned away.
8. Sensors go through **one standard interferogram format**. Never mix NISAR BETA / PROVISIONAL / VALIDATED silently.

### 3.2 Names and ports
- City `delhi-ncr`, version `v1`. Later: `ahmedabad` (second city), `bengaluru` (low-signal control).
- Approx AOI: lon 76.95 to 77.40, lat 28.30 to 28.65, EPSG:4326.
- Ports: web `5173`, API `8000`, TiTiler `8001`, MinIO `9000/9001`, Postgres `5432`, Redis `6379`. Bucket `dharadrishti`.

### 3.3 Raster and array formats
All rasters on one grid, EPSG:4326, Cloud-Optimized GeoTIFF, `float32`, nodata `-9999`.
Units: velocity, sigma = mm/yr; gradient = mm/yr per km; seasonal_amp = mm; coherence = 0..1; detection_conf = unitless.
`timeseries.zarr`: dims `(time, y, x)`, variables `disp` (mm) and `sigma` (mm), chunks = full time axis × small spatial block, Zstd. Fixture grid 300 × 300.

### 3.4 `meta.json` (Yash) and `summary.json` (Shivani)

`meta.json`:
```json
{
  "city": "delhi-ncr", "version": 1, "synthetic": false,
  "sensor": "Sentinel-1", "track": "TBD", "direction": "ascending",
  "looks": "10x2", "data_span": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"},
  "n_interferograms": {"ordered": 0, "accepted": 0, "rejected": 0},
  "reference_point": {"lon": 0.0, "lat": 0.0, "mode": "auto"},
  "atmosphere": "era5|empirical|none",
  "processor": "hyp3-isce2 x.y.z", "mintpy": "x.y.z"
}
```

`summary.json`:
```json
{
  "share_significant_motion": 0.0,
  "fastest_rate": {"value": 0.0, "sigma": 0.0},
  "hotspot_area_km2": 0.0, "coverage_pct": 0.0,
  "noise_floor_mm_yr": null, "significance_multiple": 3
}
```
Placeholders only; never ship placeholder numbers as real.

### 3.5 GeoJSON properties
- `hotspots.geojson`: `id, mean_rate (mm/yr LOS), max_rate, rate_sigma, area_km2, snr`; MultiPolygon, EPSG:4326.
- `alerts.geojson`: `rate_before, rate_after, snr, created_at`.
- `risk_zones.geojson`: `risk_index, inputs, weights_version`, every feature `"kind":"risk_heuristic"`.

### 3.6 `references.json` (Shivani)
`citation, url, area_name, reported_rate (mm/yr), rate_basis (line of sight | vertical | not stated), period, method`. Seed from the architecture: Garg et al. 2022 (Kapashera >11 cm/yr, Faridabad ~3 cm/yr, 2014 to 2020), Sadhasivam et al. 2025 (max 51 mm/yr, 2015 to 2023). **Verify the citations before showing them.**

### 3.7 API (Saksham implements, Sohan and the view owners consume)

| Method and path | Returns |
|---|---|
| `GET /health` | `{"status":"ok"}` |
| `GET /cities?status=live` | `[{slug,name,bbox,status,data_span,latest_update,sensors,active_version,synthetic}]` |
| `GET /cities/{slug}`, `/summary` | metadata; `/summary` = `meta.json` + `summary.json` merged |
| `GET /cities/{slug}/layers` | `[{id,label,group:"measured"\|"derived"\|"risk",tile_url,legend:{unit,min,max,palette,note},provenance,default_on}]` |
| `GET /cities/{slug}/snapshots` | `[{epoch,tile_url}]` |
| `GET /cities/{slug}/hotspots?min_rate=&min_snr=&bbox=` | GeoJSON |
| `GET /cities/{slug}/risk-zones?min_index=&bbox=` | GeoJSON |
| `GET /cities/{slug}/alerts?since=` and `GET /alerts?city=&since=` | GeoJSON |
| `GET /cities/{slug}/references` | `references.json` rows |
| `GET /cities/{slug}/interferograms` | accepted/rejected pairs, reasons, browse image URLs |
| `GET /cities/{slug}/profile?line=<GeoJSON LineString>` | distance (km) vs velocity and vs gradient along the line |
| `GET /tiles/{slug}/{layer}/{z}/{x}/{y}.mvt` | vector tiles |
| `GET /timeseries?city=&lon=&lat=` | JSON below, or `404 {"error":"no_reliable_measurement"}` |
| `POST /areas/stats?city=` | body GeoJSON polygon → mean series, rate, sigma, area_km2 |
| `GET /compare?cities=a,b,c` | same metrics per city with data span and geometry beside each number |
| `GET /search?q=` | cities and places only |
| `GET /downloads/{slug}/{kind}` | redirect to COG, GeoJSON or CSV |
| `POST /reports`, `GET /reports/{id}` | queue and fetch PDF |
| Admin (static token): `POST /admin/cities`, `.../plan`, `.../ingest`, `.../update`, `GET /admin/jobs/{id}`, `POST /admin/jobs/{id}/cancel` | |

`GET /timeseries` response (placeholders):
```json
{
  "city": "delhi-ncr", "measured": true, "synthetic": false,
  "pixel": {"lon": 77.0, "lat": 28.5, "coherence": 0.0},
  "unit": "mm",
  "convention": "positive = toward satellite, line-of-sight, relative to reference point",
  "series": [{"date": "2021-01-05", "value": 0.0, "sigma": 0.0}],
  "velocity": {"value": 0.0, "sigma": 0.0, "unit": "mm/yr"},
  "seasonal_amplitude_mm": 0.0,
  "provenance": {"sensor": "Sentinel-1", "track": "0", "looks": "10x2", "mintpy": "x.y.z", "product_version": "v1"}
}
```
If no valid pixel lies within ~1.5 pixel widths: 404 `"error": "no_reliable_measurement"`.

### 3.8 `StandardInterferogram` (Yash's adapters output)
Unwrapped phase (radians, city grid, nodata); coherence and connected components (same grid); LOS incidence and azimuth per pixel; **wavelength in metres per interferogram (never hard-coded)**; identity (sensor, track, direction, ref/sec date); processor and version (NISAR also maturity and release id); ionosphere applied or not (NISAR).

### 3.9 Pipeline stage functions (the only way stages are called)
Each is idempotent, returns `done` or `skipped` (output already exists), and has one owner:
`discover`, `plan`, `submit_and_poll`, `download`, `qc`, `invert`, `publish_files` → **Yash**; `derive` → **Shivani**; `load_db` (MinIO + PostGIS), `notify` → **Saksham**.
Saksham's worker calls them in this order and records status in `jobs` / `job_stages`.

### 3.10 Git
Branches: `yash/pipeline`, `sohan/frontend`, `saksham/backend`, `shivani/science`. Merge to `main` at sync points via PR; **Saksham merges**. A PR may only contain files from the author's owned paths (Section 2). Never commit secrets (`.netrc`, `.env`).

### 3.11 View-mount interface (how Yash's and Shivani's views appear in Sohan's app)
Sohan's shell auto-discovers `web/src/views-*/*/index.tsx` with `import.meta.glob` and lists each view in a **Tools** panel. A view is a folder with an `index.tsx` whose default export is:

```ts
export default {
  id: string,                       // unique, kebab-case
  title: string,
  group: "measured" | "derived" | "risk" | "tools",
  Component: (props: ViewProps) => JSX.Element,
}

interface ViewProps {
  apiUrl: string;                   // base URL of the API
  city: string;                     // active city slug
  version: number;                  // active product version
  selectedFeature: GeoJSON.Feature | null;
  flyTo(bbox: [number, number, number, number]): void;
  selectFeature(f: GeoJSON.Feature | null): void;
}
```
A view fetches its own data with `fetch(apiUrl + ...)`, imports nothing from Sohan's folders, and shows all text it gets from the API (including the risk disclaimer from `/layers`) without rewording it. Sohan's shell shows the synthetic banner for the whole app.

---

## 4. Handoffs (the only places two people connect)

| # | From → To | What | When |
|---|---|---|---|
| H1 | Saksham → all | Repo skeleton, folders, CI, `docker-compose.yml` | H0.5 |
| H2 | Sohan → Yash, Shivani | View shell auto-discovery working (an empty view shows up in Tools) | H1.5 |
| H3 | Shivani → Saksham, Sohan | Fixture in `data/fixture/delhi-ncr/v1/` (incl. derived files) | **Sync 1 (H1.5 to H2)** |
| H4 | Saksham → Sohan | Real API on `:8000` serving the fixture; `layers.yaml` text via `/layers` | Sync 1 to Sync 2 |
| H5 | Yash → Shivani | `velocity.tif`, `velocity_sigma.tif`, `timeseries.zarr`, `seasonal_amp.tif` | Sync 3 (H8) or earlier on partial data |
| H6 | Shivani → Saksham | Derived files + `summary.json` + `references.json` | after `dd derive` on real data |
| H7 | Yash → Saksham | `meta.json`, `interferograms.json`, `browse/`, `cost.json`, real rasters | H8 |
| H8 | Shivani → Saksham | `docs/limitations.md` for PDF reports | H8 |

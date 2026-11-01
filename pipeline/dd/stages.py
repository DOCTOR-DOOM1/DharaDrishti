"""
pipeline/dd/stages.py

Idempotent stage functions — the ONLY way the pipeline stages are called.

Each function:
  - Returns "done" if it ran successfully
  - Returns "skipped" if output already exists
  - Raises an exception on actual failure

Saksham's worker calls these in order:
  discover → plan → submit_and_poll → download → qc → invert → publish_files

Shivani adds:
  derive (in pipeline/dd/derive/stages.py)

Saksham adds:
  load_db → notify
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Literal

from pipeline.dd.config import (
    REPO_ROOT,
    interferograms_dir,
    load_city_config,
    products_dir,
    raw_dir,
)

log = logging.getLogger(__name__)

StageResult = Literal["done", "skipped"]


# ---------------------------------------------------------------------------
# Stage 1: Discover
# ---------------------------------------------------------------------------

def discover(slug: str) -> StageResult:
    """
    Search ASF for new acquisitions since the last run.
    Writes the scene list to data/interferograms/<slug>/scenes.json.
    Idempotent: if scenes.json already exists and is fresh (today), returns 'skipped'.
    """
    from datetime import date
    idir = interferograms_dir(slug)
    scenes_path = idir / "scenes.json"

    # Check if already done today
    if scenes_path.exists():
        mtime_date = date.fromtimestamp(scenes_path.stat().st_mtime)
        if mtime_date == date.today():
            log.info("[discover] scenes.json is fresh — skipping")
            return "skipped"

    cfg = load_city_config(slug)
    aoi = cfg.get("aoi", {})
    aoi_wkt = cfg.get("aoi_wkt") or (
        f"POLYGON(({aoi['west']} {aoi['south']},"
        f"{aoi['east']} {aoi['south']},"
        f"{aoi['east']} {aoi['north']},"
        f"{aoi['west']} {aoi['north']},"
        f"{aoi['west']} {aoi['south']}))"
    )

    from pipeline.dd.sensors.sentinel1_hyp3 import Sentinel1HyP3Adapter
    adapter = Sentinel1HyP3Adapter()

    data_span = cfg.get("data_span", {})
    start = data_span.get("start", "2020-01-01")
    end = str(date.today())

    scenes = adapter.search(
        aoi_wkt, start, end,
        direction=cfg.get("direction"),
        track=str(cfg.get("track", "")),
    )

    idir.mkdir(parents=True, exist_ok=True)
    with (idir / "scenes.json").open("w") as fh:
        json.dump(scenes, fh, indent=2)

    log.info("[discover] Found %d scenes → %s", len(scenes), scenes_path)
    return "done"


# ---------------------------------------------------------------------------
# Stage 2: Plan
# ---------------------------------------------------------------------------

def plan(slug: str) -> StageResult:
    """
    Plan interferogram pairs. Skips existing keys.
    Writes data/interferograms/<slug>/plan.json.
    """
    idir = interferograms_dir(slug)
    plan_path = idir / "plan.json"
    scenes_path = idir / "scenes.json"

    if not scenes_path.exists():
        raise RuntimeError("Run 'discover' stage first")

    with scenes_path.open() as fh:
        scenes = json.load(fh)

    dates = [s["date"] for s in scenes]

    # Load existing keys
    store_index = idir / "store_index.json"
    existing_keys: set[str] = set()
    if store_index.exists():
        with store_index.open() as fh:
            existing_keys = set(json.load(fh).get("keys", []))

    cfg = load_city_config(slug)
    hyp3_cfg = cfg.get("hyp3", {})

    from pipeline.dd.planning.network import plan_pairs
    pairs = plan_pairs(
        dates,
        max_temporal_days=hyp3_cfg.get("max_temporal_days", 48),
        existing_keys=existing_keys,
        direction=cfg.get("direction", "ascending"),
        looks=hyp3_cfg.get("looks", "20x4"),
    )

    if not pairs:
        log.info("[plan] No new pairs to process")
        return "skipped"

    from pipeline.dd.planning.credits import estimate_total, check_budget
    est = estimate_total(len(pairs), hyp3_cfg.get("looks", "20x4"),
                         n_bursts=hyp3_cfg.get("n_bursts", 8))
    monthly_cap = cfg.get("budget", {}).get("max_credits_per_month", 500)
    budget_check = check_budget(est, monthly_cap)

    plan_data = {
        "slug": slug,
        "looks": hyp3_cfg.get("looks", "20x4"),
        "pairs": [{"ref": r, "sec": s} for r, s in pairs],
        "estimated_credits": est,
        "budget_ok": budget_check["ok"],
    }

    with plan_path.open("w") as fh:
        json.dump(plan_data, fh, indent=2)

    log.info("[plan] %d new pairs planned → %s", len(pairs), plan_path)
    return "done"


# ---------------------------------------------------------------------------
# Stage 3: Submit and poll
# ---------------------------------------------------------------------------

def submit_and_poll(slug: str) -> StageResult:
    """
    Submit HyP3 jobs for planned pairs and poll until complete.
    Writes data/interferograms/<slug>/jobs.json with job IDs and status.
    Idempotent: re-polls if jobs.json exists but jobs are not all done.
    State 'waiting_for_credits' is not a failure — caller can retry.
    """
    import time
    idir = interferograms_dir(slug)
    plan_path = idir / "plan.json"
    jobs_path = idir / "jobs.json"

    if not plan_path.exists():
        raise RuntimeError("Run 'plan' stage first")

    with plan_path.open() as fh:
        plan_data = json.load(fh)

    cfg = load_city_config(slug)
    hyp3_cfg = cfg.get("hyp3", {})
    looks = plan_data.get("looks", "20x4")
    monthly_cap = cfg.get("budget", {}).get("max_credits_per_month", 500)

    # Load or init jobs state
    jobs: dict = {}
    if jobs_path.exists():
        with jobs_path.open() as fh:
            jobs = json.load(fh)

    pairs_to_submit = [
        (p["ref"], p["sec"])
        for p in plan_data["pairs"]
        if f"{p['ref']}_{p['sec']}" not in jobs
    ]

    from pipeline.dd.sensors.sentinel1_hyp3 import Sentinel1HyP3Adapter
    adapter = Sentinel1HyP3Adapter(hyp3_cfg.get("api_url", "https://hyp3-api.asf.alaska.edu"))

    if pairs_to_submit:
        if not plan_data.get("budget_ok", True):
            log.warning("[submit] Budget may be exceeded — state: waiting_for_credits")
            return "skipped"  # caller should set state to waiting_for_credits

        aoi = cfg.get("aoi", {})
        aoi_wkt = cfg.get("aoi_wkt", "")
        job_ids = adapter.submit(pairs_to_submit, aoi_wkt, looks,
                                 budget_credits=monthly_cap)

        for i, (ref, sec) in enumerate(pairs_to_submit[:len(job_ids)]):
            key = f"{ref}_{sec}"
            jobs[key] = {"job_id": job_ids[i], "status": "queued", "ref": ref, "sec": sec}

        with jobs_path.open("w") as fh:
            json.dump(jobs, fh, indent=2)

    # Poll until all done (or timeout)
    max_polls = 60
    poll_interval = 60  # seconds
    for attempt in range(max_polls):
        pending_ids = [v["job_id"] for v in jobs.values()
                       if v.get("status") not in ("SUCCEEDED", "FAILED")]
        if not pending_ids:
            break

        statuses = adapter.poll(pending_ids)
        for s in statuses:
            for key, job in jobs.items():
                if job["job_id"] == s["job_id"]:
                    jobs[key]["status"] = s["status"]
                    jobs[key]["files"] = s.get("files", [])

        with jobs_path.open("w") as fh:
            json.dump(jobs, fh, indent=2)

        all_done = all(
            v.get("status") in ("SUCCEEDED", "FAILED")
            for v in jobs.values()
        )
        if all_done:
            break

        log.info("[submit_and_poll] %d pending … (attempt %d/%d)",
                 len(pending_ids), attempt + 1, max_polls)
        time.sleep(poll_interval)

    n_succeeded = sum(1 for v in jobs.values() if v.get("status") == "SUCCEEDED")
    n_failed = sum(1 for v in jobs.values() if v.get("status") == "FAILED")
    log.info("[submit_and_poll] %d succeeded, %d failed", n_succeeded, n_failed)

    return "done"


# ---------------------------------------------------------------------------
# Stage 4: Download
# ---------------------------------------------------------------------------

def download(slug: str) -> StageResult:
    """
    Download succeeded HyP3 jobs to data/raw/<slug>/.
    Uses immutable key — never re-downloads an existing key.
    """
    idir = interferograms_dir(slug)
    jobs_path = idir / "jobs.json"
    store_index = idir / "store_index.json"

    if not jobs_path.exists():
        raise RuntimeError("Run 'submit_and_poll' stage first")

    with jobs_path.open() as fh:
        jobs = json.load(fh)

    existing_keys: set[str] = set()
    if store_index.exists():
        with store_index.open() as fh:
            existing_keys = set(json.load(fh).get("keys", []))

    from pipeline.dd.sensors.sentinel1_hyp3 import Sentinel1HyP3Adapter
    cfg = load_city_config(slug)
    hyp3_cfg = cfg.get("hyp3", {})
    adapter = Sentinel1HyP3Adapter(hyp3_cfg.get("api_url", "https://hyp3-api.asf.alaska.edu"))

    rdir = raw_dir(slug)
    new_keys: list[str] = []

    for key, job in jobs.items():
        if job.get("status") != "SUCCEEDED":
            continue

        job_id = job["job_id"]
        dest = rdir / job_id

        # Check immutable key (simplified: use job_id as key)
        if job_id in existing_keys:
            log.info("[download] %s already downloaded — skipping", job_id)
            continue

        try:
            local_path = adapter.download(job_id, dest)
            new_keys.append(job_id)
            log.info("[download] Downloaded %s → %s", job_id, local_path)
        except Exception as exc:
            log.error("[download] Failed for %s: %s", job_id, exc)

    # Update store index
    all_keys = list(existing_keys | set(new_keys))
    with store_index.open("w") as fh:
        json.dump({"keys": all_keys}, fh, indent=2)

    if not new_keys:
        return "skipped"

    log.info("[download] Downloaded %d new products", len(new_keys))
    return "done"


# ---------------------------------------------------------------------------
# Stage 5: QC
# ---------------------------------------------------------------------------

def qc(slug: str) -> StageResult:
    """
    Run QC on downloaded interferograms.
    Writes interferograms_meta.json with accepted/rejected pairs.
    """
    idir = interferograms_dir(slug)
    meta_path = idir / "interferograms_meta.json"
    store_index = idir / "store_index.json"

    if not store_index.exists():
        raise RuntimeError("Run 'download' stage first")

    with store_index.open() as fh:
        keys = json.load(fh).get("keys", [])

    if not keys:
        log.info("[qc] No downloaded products to QC")
        return "skipped"

    cfg = load_city_config(slug)
    qc_cfg = cfg.get("qc", {})
    rdir = raw_dir(slug)

    from pipeline.dd.qc.coherence import qc_interferogram

    # Load existing meta (idempotent — only process new)
    existing: dict[str, dict] = {}
    if meta_path.exists():
        with meta_path.open() as fh:
            for item in json.load(fh):
                existing[item["job_id"]] = item

    new_meta = []
    for job_id in keys:
        if job_id in existing:
            new_meta.append(existing[job_id])
            continue

        job_dir = rdir / job_id
        if not job_dir.exists():
            continue

        corr_files = list(job_dir.rglob("*.corr.tif"))
        conn_files = list(job_dir.rglob("*.conncomp.tif"))

        if not corr_files or not conn_files:
            log.warning("[qc] Missing files for %s", job_id)
            continue

        result = qc_interferogram(
            corr_files[0],
            conn_files[0],
            coherence_threshold=qc_cfg.get("min_coherence", 0.3),
            min_component_fraction=qc_cfg.get("min_component_fraction", 0.05),
        )

        mean_coh = result["checks"]["coherence"].get("mean_coherence")
        new_meta.append({
            "job_id": job_id,
            "accepted": result["accepted"],
            "rejection_reason": result["rejection_reason"],
            "mean_coherence": mean_coh,
            "checks": result["checks"],
        })

    with meta_path.open("w") as fh:
        json.dump(new_meta, fh, indent=2)

    n_acc = sum(1 for m in new_meta if m["accepted"])
    log.info("[qc] %d/%d accepted", n_acc, len(new_meta))
    return "done"


# ---------------------------------------------------------------------------
# Stage 6: Invert
# ---------------------------------------------------------------------------

def invert(slug: str) -> StageResult:
    """
    Run MintPy SBAS inversion.
    Idempotent: if geo_velocity.h5 already exists, returns 'skipped'.
    """
    work_dir = REPO_ROOT / "data" / "mintpy" / slug
    vel_path = work_dir / "geo" / "geo_velocity.h5"

    if vel_path.exists():
        log.info("[invert] geo_velocity.h5 exists — skipping")
        return "skipped"

    cfg = load_city_config(slug)
    rdir = raw_dir(slug)

    from pipeline.dd.timeseries.mintpy_runner import write_mintpy_config, run_mintpy
    cfg_path = write_mintpy_config(cfg, work_dir, rdir)
    run_mintpy(cfg_path, work_dir)

    return "done"


# ---------------------------------------------------------------------------
# Stage 7: Publish files
# ---------------------------------------------------------------------------

def publish_files(slug: str, version: int = 1, synthetic: bool = False) -> StageResult:
    """
    Export MintPy products to data/products/<slug>/v<version>/.
    Idempotent: if meta.json exists and synthetic flag matches, returns 'skipped'.
    """
    pdir = products_dir(slug, version)
    meta_path = pdir / "meta.json"

    if meta_path.exists():
        with meta_path.open() as fh:
            existing_meta = json.load(fh)
        if existing_meta.get("synthetic") == synthetic:
            log.info("[publish_files] meta.json exists with correct synthetic flag — skipping")
            return "skipped"

    cfg = load_city_config(slug)
    work_dir = REPO_ROOT / "data" / "mintpy" / slug

    # Load interferogram metadata
    idir = interferograms_dir(slug)
    ifg_meta_path = idir / "interferograms_meta.json"
    ifg_meta = None
    if ifg_meta_path.exists():
        with ifg_meta_path.open() as fh:
            ifg_meta = json.load(fh)

    from pipeline.dd.publish.export import publish_products
    publish_products(
        slug=slug,
        version=version,
        mintpy_work_dir=work_dir,
        city_config=cfg,
        interferograms_meta=ifg_meta,
        synthetic=synthetic,
    )
    return "done"


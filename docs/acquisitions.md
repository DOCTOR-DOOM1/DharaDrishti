# Sentinel-1 Acquisitions — delhi-ncr

> **Note:** This file is a placeholder. Run `dd acquisitions report delhi-ncr` after setting up
> your Earthdata credentials (`~/.netrc`) to populate this with real counts.

**Search period:** TBD → TBD
**Total scenes found:** TBD
**Best track/direction:** TBD

## Per-year breakdown

| Year | Track | Direction | Scenes |
|------|-------|-----------|--------|
| TBD  | TBD   | TBD       | TBD    |

## Notes
- Counts are from a live ASF search — not assumed 6-day cadence.
- Track selection is based on scene count; refine with coverage check after inspecting spatial coverage.

## NISAR Coverage
- Check NISAR observation plan: https://nisar.jpl.nasa.gov/mission/coverage/
- LiCSAR frame check: https://comet.nerc.ac.uk/COMET-LiCS-portal/

## Action required
1. Set up `~/.netrc` with your NASA Earthdata credentials:
   ```
   machine urs.earthdata.nasa.gov
   login <your_username>
   password <your_password>
   ```
2. Activate the conda environment: `conda activate dharadrishti`
3. Run: `python -m pipeline.dd.cli acquisitions report delhi-ncr`


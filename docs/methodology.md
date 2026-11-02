# DharaDrishti — Scientific Methodology

> **Author:** Shivani (Derived Science & Validation)

### 1. InSAR Processing Paradigm: Process-Once, Serve-Forever
DharaDrishti is built on the tenet that heavy interferometric and time-series inversion must never occur at request time. SAR processing occurs asynchronously in offline pipeline runs using ASF HyP3 (ISCE2 burst workflows) and MintPy SBAS. The output products are standardized into Cloud-Optimized GeoTIFFs (COGs) and chunked Zarr arrays on a unified WGS84 (EPSG:4326) geographic grid.

### 2. Physical Measurement vs. Derived Science vs. Risk
The platform strictly bifurcates outputs into three non-overlapping tiers:
1. **Measured:**
   - Line-of-Sight (LOS) velocity ($v$) in mm/yr
   - Velocity uncertainty ($\sigma_v$) in mm/yr
   - Temporal coherence ($\gamma$) in $[0, 1]$
   - Seasonal amplitude ($A = \sqrt{c^2 + s^2}$) in mm
   - Time-series displacement $d(t)$ in mm
2. **Derived:**
   - Spatial velocity gradient $|\nabla v|$ in mm/yr/km
   - Detection confidence ratio ($|v| / \sigma_v$)
   - Subsidence hotspot clusters (MultiPolygon GeoJSON)
   - Velocity rate change alerts
3. **Risk (Heuristic):**
   - Normalized screening index combining subsidence rate, differential settlement gradient, and infrastructure density.
   - **Label Requirement:** Always rendered with the persistent disclaimer: *"Screening index, not a prediction of damage."* Risk layers are toggled off by default.

### 3. Noise Floor & Significance Criteria
True ground motion cannot be reliably distinguished from atmospheric and unwrapping noise without a stated significance criterion.
* We designate a geologically stable control area (e.g. North-Central Ridge of Delhi).
* The 1-sigma scatter of velocity within this stable reference area defines the empirical **noise floor** ($\sigma_{floor}$).
* A subsidence signal is declared as a detected hotspot only when:
  $$\text{Detection Confidence} = \frac{|v|}{\sigma_v} \ge 3.0$$
  and the cluster spans at least 15 contiguous valid pixels.

### 4. Differential Settlement
Infrastructure damage is primarily driven by differential settlement rather than uniform subsidence. The spatial velocity gradient $|\nabla v|$:
$$|\nabla v| = \sqrt{\left(\frac{\partial v}{\partial x}\right)^2 + \left(\frac{\partial v}{\partial y}\right)^2}$$
provides early screening for angular distortion across civil foundation boundaries.


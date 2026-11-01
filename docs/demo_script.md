# DharaDrishti — Live Demo Script (2–3 Minutes)

> **Presenters:** Shivani (Narrator) · Sohan (UI Operator) · Yash (SAR/Pipeline) · Saksham (Backend/Infra)

---

### Step 1: Context & The Zero-Fabrication Principle (0:00 - 0:30)
- **Speaker:** Shivani
- **Visual:** Full-screen web dashboard with persistent red banner: `"SYNTHETIC TEST DATA — not a measurement"`.
- **Narrative:** 
  > "Land subsidence across Indian cities is heavily under-monitored. But building a monitoring tool requires honesty first:
  > 1. Only interferometric phase converted to displacement is a measurement.
  > 2. We never interpolate low-coherence pixels.
  > 3. Synthetic test data is loudly labelled."

### Step 2: City Overview & Velocity Field (0:30 - 1:00)
- **Visual:** Sohan toggles the **LOS Velocity** layer. The divergent blue-white-red palette shows prominent red bowls in southwest Delhi / NCR.
- **Narrative:**
  > "Notice our velocity map. Negative values in red represent displacement away from the satellite along its line-of-sight. The Yamuna river corridor is transparent because coherence dropped below 0.3—we mask it rather than fabricating numbers."

### Step 3: Hotspot Click & Time Series with Error Band (1:00 - 1:45)
- **Visual:** Sohan clicks the Kapashera hotspot.
- **Visual:** The right panel opens the Time Series chart. The displacement curve displays:
  - Error band (1σ envelope)
  - Seasonal sinusoidal oscillation (monsoon recharge)
  - Long-term downward velocity: -48.2 ± 2.1 mm/yr
  - Convention banner: *"positive = toward satellite, line-of-sight, relative to reference point"*.
- **Narrative:**
  > "Every single pixel query pulls instantaneous chunked data from Zarr with full uncertainty propagation. Notice the seasonal rebound: post-monsoon recharge slows down subsidence temporarily before dry-season extraction resumes."

### Step 4: Published Literature Validation (1:45 - 2:15)
- **Visual:** Sohan opens the **Tools** tab and selects **Published vs Ours** (Shivani's view).
- **Narrative:**
  > "We don't grade our own homework. Our validation panel compares our derived velocity with published studies (Garg et al. 2022, Sadhasivam et al. 2025 Nature Sustainability). We disclose rate basis, observation periods, and discrepancies openly."

### Step 5: Risk Heuristic Layer & Limitations (2:15 - 2:45)
- **Visual:** Sohan toggles the **Risk Index** layer.
- **Visual:** Prominent disclaimer appears: *"Screening index, not a prediction of damage"*.
- **Narrative:**
  > "Finally, our risk layer is off by default. It combines velocity gradients with exposure as a screening indicator for municipal engineers, never as an unvalidated structural damage prediction."

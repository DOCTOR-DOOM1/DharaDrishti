# DharaDrishti — Scientific Limitations & Measurement Boundaries

> **Author:** Shivani (Derived Science & Validation Track)  
> **Audience:** Operators, Scientific Reviewers, PDF Report Disclaimers

### 1. Line-of-Sight (LOS) Displacement vs. Vertical Subsidence
* **Principle:** InSAR measures displacement along the satellite’s Line-of-Sight (LOS) vector, defined by the local incidence angle $\theta$ and heading azimuth $\alpha$.
* **Implication:** Single-orbit measurements (e.g., ascending only) cannot be silently interpreted as purely vertical displacement without assuming zero horizontal deformation ($d_x = d_y = 0$). For Sentinel-1 with an incidence angle of $\approx 39^\circ$, the vertical component corresponds to $\approx \cos(39^\circ) \approx 0.77$ of the LOS displacement for purely vertical motion. 
* **Rule:** LOS values are **never** labelled as "vertical" unless decomposed using both ascending and descending acquisitions.

### 2. Relative Measurements & Reference Point Selection
* **Principle:** All InSAR displacement measurements are relative in space to an arbitrary reference point ($x_{ref}, y_{ref}$) and relative in time to the first acquisition epoch ($t_0$).
* **Implication:** A measurement of $-30\text{ mm/yr}$ indicates that the pixel is subsiding at $30\text{ mm/yr}$ *relative* to the reference station. If the reference station itself experiences regional deformation, absolute regional subsidence will differ.
* **Selection:** The reference point is placed in a geologically stable, high-coherence bedrock or stable structure location.

### 3. C-Band Coherence Limits (Sentinel-1)
* **Principle:** Sentinel-1 operates at C-band ($\lambda = 5.546\text{ cm}$). Temporal decorrelation occurs over dense vegetation, agricultural fields during tilling/irrigation, and water bodies.
* **Masking Policy:** Pixels with temporal coherence below the strict threshold ($\gamma < 0.3$) are masked as `nodata` ($-9999$). The platform **never interpolates** across missing or low-coherence regions.

### 4. Atmospheric Phase Screens (APS)
* **Principle:** Tropospheric water vapor variations introduce path delay variations between SAR acquisitions.
* **Mitigation:** While weather models (ERA5 via PyAPS) or empirical phase-elevation relationships are applied, long-wavelength residual atmospheric artifacts may persist, particularly during monsoon transitions.

### 5. Multi-Sensor Data Integrity (NISAR vs. Sentinel-1)
* **Principle:** L-band (NISAR, $\lambda \approx 24\text{ cm}$) and C-band (Sentinel-1, $\lambda \approx 5.5\text{ cm}$) have different penetration depths and scatterer sensitivity.
* **Policy:** NISAR products in BETA or PROVISIONAL maturity states are strictly segregated and clearly labelled as experimental. They are never blended into Sentinel-1 multi-year velocity fields.


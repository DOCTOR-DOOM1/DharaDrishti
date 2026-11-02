/**
 * web/src/views-science/references/index.tsx
 *
 * Published Literature Validation View.
 * Owned by Shivani — mounts in Sohan's Tools panel via auto-discovery.
 *
 * Compares published ground/InSAR rates with our measurements.
 * Displays rate basis, time period, citations, and differences honestly.
 */

import React, { useEffect, useState } from "react";

interface ViewProps {
  apiUrl: string;
  city: string;
  version: number;
  selectedFeature: GeoJSON.Feature | null;
  flyTo(bbox: [number, number, number, number]): void;
  selectFeature(f: GeoJSON.Feature | null): void;
}

interface ReferenceItem {
  citation: string;
  url: string;
  area_name: string;
  reported_rate: number;
  rate_basis: string;
  period: string;
  method: string;
}

interface SummaryData {
  noise_floor_mm_yr: number | null;
  fastest_rate: { value: number; sigma: number };
  share_significant_motion: number;
  coverage_pct: number;
  significance_multiple: number;
}

function ReferencesView({ apiUrl, city }: ViewProps) {
  const [refs, setRefs] = useState<ReferenceItem[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!city) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${apiUrl}/cities/${city}/references`).then((r) => r.json()),
      fetch(`${apiUrl}/cities/${city}/summary`).then((r) => r.json())
    ])
      .then(([refData, sumData]) => {
        setRefs(Array.isArray(refData) ? refData : []);
        setSummary(sumData);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [apiUrl, city]);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>📚 Published Literature vs. Ours</h2>

      <div style={styles.card}>
        <h4 style={{ margin: "0 0 8px 0", color: "#93c5fd" }}>Scientific Honesty & Calibration</h4>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#cbd5e1" }}>
          InSAR velocities are reported in Line-of-Sight (LOS) relative to a local reference point.
          Differences with literature arise from differing observation windows, PS vs SBAS methods,
          and LOS vs vertical conversion assumptions. Disagreements are reported transparently.
        </p>
      </div>

      {loading && <p style={styles.info}>Loading reference benchmarks…</p>}
      {error && <p style={styles.error}>Error: {error}</p>}

      {summary && (
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Noise Floor (1σ)</span>
            <span style={styles.statValue}>
              {summary.noise_floor_mm_yr !== null ? `${summary.noise_floor_mm_yr} mm/yr` : "—"}
            </span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Max Subsidence Rate</span>
            <span style={styles.statValue}>
              {summary.fastest_rate ? `${summary.fastest_rate.value} mm/yr` : "—"}
            </span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Detection Multiple</span>
            <span style={styles.statValue}>
              {summary.significance_multiple}× σ
            </span>
          </div>
        </div>
      )}

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Site / Area</th>
              <th style={styles.th}>Published Rate</th>
              <th style={styles.th}>Period</th>
              <th style={styles.th}>Basis & Method</th>
              <th style={styles.th}>Citation</th>
            </tr>
          </thead>
          <tbody>
            {refs.map((r, idx) => (
              <tr key={idx} style={styles.tr}>
                <td style={{ ...styles.td, fontWeight: 600, color: "#f8fafc" }}>{r.area_name}</td>
                <td style={{ ...styles.td, color: "#f87171", fontWeight: 700 }}>
                  {r.reported_rate} mm/yr
                </td>
                <td style={styles.td}>{r.period}</td>
                <td style={styles.td}>
                  <span style={styles.basisTag}>{r.rate_basis}</span>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{r.method}</div>
                </td>
                <td style={styles.td}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#60a5fa", textDecoration: "none" }}
                  >
                    {r.citation} ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "12px 16px",
    fontFamily: "system-ui, sans-serif",
    color: "#e2e8f0",
    height: "100%",
    overflowY: "auto",
    boxSizing: "border-box"
  },
  title: {
    margin: "0 0 12px",
    fontSize: 18,
    fontWeight: 700,
    color: "#93c5fd"
  },
  card: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16
  },
  info: { color: "#94a3b8" },
  error: { color: "#ef4444" },
  statsRow: {
    display: "flex",
    gap: 12,
    marginBottom: 16,
    flexWrap: "wrap"
  },
  statBox: {
    flex: 1,
    minWidth: 120,
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 6,
    padding: "8px 12px"
  },
  statLabel: {
    display: "block",
    fontSize: 11,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
  },
  statValue: {
    display: "block",
    fontSize: 16,
    fontWeight: 700,
    color: "#f8fafc",
    marginTop: 4
  },
  tableWrapper: {
    overflowX: "auto",
    borderRadius: 8,
    border: "1px solid #334155"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13
  },
  th: {
    textAlign: "left",
    padding: "8px 10px",
    background: "#1e293b",
    color: "#94a3b8",
    fontWeight: 600,
    borderBottom: "1px solid #334155"
  },
  tr: {
    borderBottom: "1px solid #1e293b"
  },
  td: {
    padding: "8px 10px",
    verticalAlign: "middle"
  },
  basisTag: {
    background: "#334155",
    color: "#e2e8f0",
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 11,
    textTransform: "uppercase"
  }
};

const view = {
  id: "science-references",
  title: "Published vs Ours",
  group: "derived" as const,
  Component: ReferencesView
};

export default view;


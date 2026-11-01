/**
 * web/src/views-sar/interferograms/index.tsx
 *
 * Interferogram Browser view.
 * Owned by Yash — appears in Sohan's Tools panel via auto-discovery.
 *
 * Shows accepted/rejected interferogram pairs from the API with:
 *  - Reference and secondary dates
 *  - Acceptance status + rejection reason
 *  - Mean coherence
 *  - Browse PNG thumbnails
 *
 * Contract (section 3.11):
 *  - Default export: { id, title, group, Component }
 *  - Component receives ViewProps: { apiUrl, city, version, selectedFeature, flyTo, selectFeature }
 *  - Uses fetch(apiUrl + ...) only — imports NOTHING from Sohan's folders
 */

import React, { useEffect, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types (local, do not import from Sohan's code)
// ---------------------------------------------------------------------------

interface ViewProps {
  apiUrl: string;
  city: string;
  version: number;
  selectedFeature: GeoJSON.Feature | null;
  flyTo(bbox: [number, number, number, number]): void;
  selectFeature(f: GeoJSON.Feature | null): void;
}

interface Interferogram {
  id: string;
  ref_date: string;
  sec_date: string;
  temporal_baseline_days: number;
  accepted: boolean;
  rejection_reason: string | null;
  mean_coherence: number | null;
  browse_url: string | null;
  sensor: string;
  track: string;
  direction: string;
  looks: string;
  processor: string;
  processor_version: string;
  job_id: string;
  synthetic: boolean;
}

interface InterferogramsResponse {
  city: string;
  version: number;
  synthetic: boolean;
  interferograms: Interferogram[];
}

type FilterState = "all" | "accepted" | "rejected";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function InterferogramBrowser({ apiUrl, city, version }: ViewProps) {
  const [data, setData] = useState<InterferogramsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>("all");
  const [selected, setSelected] = useState<Interferogram | null>(null);

  useEffect(() => {
    if (!city) return;
    setLoading(true);
    setError(null);
    fetch(`${apiUrl}/cities/${city}/interferograms`)
      .then((r) => {
        if (!r.ok) throw new Error(`API error ${r.status}`);
        return r.json();
      })
      .then((d: InterferogramsResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [apiUrl, city, version]);

  const filtered = data?.interferograms.filter((ifg) => {
    if (filter === "accepted") return ifg.accepted;
    if (filter === "rejected") return !ifg.accepted;
    return true;
  }) ?? [];

  const stats = data
    ? {
        total: data.interferograms.length,
        accepted: data.interferograms.filter((i) => i.accepted).length,
        rejected: data.interferograms.filter((i) => !i.accepted).length,
      }
    : null;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🛰 Interferogram Browser</h2>

      {data?.synthetic && (
        <div style={styles.syntheticBanner}>
          ⚠️ SYNTHETIC TEST DATA — not a measurement
        </div>
      )}

      {loading && <p style={styles.info}>Loading interferograms…</p>}
      {error && <p style={styles.error}>Error: {error}</p>}

      {stats && (
        <div style={styles.stats}>
          <span style={styles.statBadge}>Total: {stats.total}</span>
          <span style={{ ...styles.statBadge, backgroundColor: "#22c55e" }}>
            ✓ Accepted: {stats.accepted}
          </span>
          <span style={{ ...styles.statBadge, backgroundColor: "#ef4444" }}>
            ✗ Rejected: {stats.rejected}
          </span>
        </div>
      )}

      {data && (
        <>
          {/* Filter tabs */}
          <div style={styles.filterRow}>
            {(["all", "accepted", "rejected"] as FilterState[]).map((f) => (
              <button
                key={f}
                style={{
                  ...styles.filterBtn,
                  ...(filter === f ? styles.filterBtnActive : {}),
                }}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Table */}
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Reference</th>
                  <th style={styles.th}>Secondary</th>
                  <th style={styles.th}>ΔT (days)</th>
                  <th style={styles.th}>Coherence</th>
                  <th style={styles.th}>Reason</th>
                  <th style={styles.th}>Browse</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ifg) => (
                  <tr
                    key={ifg.id}
                    style={{
                      ...styles.tr,
                      backgroundColor:
                        selected?.id === ifg.id
                          ? "#1e3a5f"
                          : ifg.accepted
                          ? "transparent"
                          : "#2d1515",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelected(selected?.id === ifg.id ? null : ifg)}
                  >
                    <td style={styles.td}>
                      {ifg.accepted ? (
                        <span style={styles.badgeGreen}>✓</span>
                      ) : (
                        <span style={styles.badgeRed}>✗</span>
                      )}
                    </td>
                    <td style={styles.td}>{ifg.ref_date}</td>
                    <td style={styles.td}>{ifg.sec_date}</td>
                    <td style={styles.td}>{ifg.temporal_baseline_days}</td>
                    <td style={styles.td}>
                      {ifg.mean_coherence != null
                        ? ifg.mean_coherence.toFixed(3)
                        : "—"}
                    </td>
                    <td style={{ ...styles.td, color: "#f59e0b", fontSize: 12 }}>
                      {ifg.rejection_reason ?? "—"}
                    </td>
                    <td style={styles.td}>
                      {ifg.browse_url ? (
                        <img
                          src={ifg.browse_url}
                          alt={`${ifg.ref_date}→${ifg.sec_date}`}
                          style={styles.thumb}
                          loading="lazy"
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={styles.detail}>
              <h3 style={{ marginTop: 0, color: "#93c5fd" }}>
                Interferogram Detail
              </h3>
              <table>
                <tbody>
                  {[
                    ["Reference date", selected.ref_date],
                    ["Secondary date", selected.sec_date],
                    ["Temporal baseline", `${selected.temporal_baseline_days} days`],
                    ["Status", selected.accepted ? "Accepted ✓" : `Rejected: ${selected.rejection_reason}`],
                    ["Sensor", selected.sensor],
                    ["Track", selected.track],
                    ["Direction", selected.direction],
                    ["Looks", selected.looks],
                    ["Processor", `${selected.processor} v${selected.processor_version}`],
                    ["Job ID", selected.job_id],
                    [
                      "Mean coherence",
                      selected.mean_coherence != null
                        ? selected.mean_coherence.toFixed(3)
                        : "—",
                    ],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <td style={{ ...styles.td, color: "#94a3b8", paddingRight: 16 }}>
                        {label}
                      </td>
                      <td style={styles.td}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selected.browse_url && (
                <div style={{ marginTop: 12 }}>
                  <img
                    src={selected.browse_url}
                    alt="Browse thumbnail"
                    style={{ maxWidth: "100%", borderRadius: 6 }}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles (inline — no imports from Sohan's code)
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "12px 16px",
    fontFamily: "system-ui, sans-serif",
    color: "#e2e8f0",
    height: "100%",
    overflowY: "auto",
    boxSizing: "border-box",
  },
  title: {
    margin: "0 0 12px",
    fontSize: 18,
    fontWeight: 700,
    color: "#93c5fd",
  },
  syntheticBanner: {
    background: "#7f1d1d",
    color: "#fca5a5",
    padding: "6px 12px",
    borderRadius: 6,
    marginBottom: 12,
    fontWeight: 700,
    fontSize: 13,
  },
  info: { color: "#94a3b8" },
  error: { color: "#ef4444" },
  stats: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  statBadge: {
    background: "#374151",
    padding: "4px 10px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
  },
  filterRow: {
    display: "flex",
    gap: 6,
    marginBottom: 12,
  },
  filterBtn: {
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#94a3b8",
    padding: "4px 12px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  },
  filterBtnActive: {
    background: "#1d4ed8",
    border: "1px solid #3b82f6",
    color: "#fff",
  },
  tableWrapper: {
    overflowX: "auto",
    borderRadius: 8,
    border: "1px solid #334155",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: "8px 10px",
    background: "#1e293b",
    color: "#94a3b8",
    fontWeight: 600,
    borderBottom: "1px solid #334155",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #1e293b",
    transition: "background 0.1s",
  },
  td: {
    padding: "7px 10px",
    verticalAlign: "middle",
  },
  badgeGreen: {
    background: "#14532d",
    color: "#4ade80",
    padding: "2px 8px",
    borderRadius: 8,
    fontWeight: 700,
  },
  badgeRed: {
    background: "#450a0a",
    color: "#f87171",
    padding: "2px 8px",
    borderRadius: 8,
    fontWeight: 700,
  },
  thumb: {
    width: 80,
    height: 40,
    objectFit: "cover",
    borderRadius: 4,
    border: "1px solid #334155",
  },
  detail: {
    marginTop: 16,
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "12px 16px",
  },
};

// ---------------------------------------------------------------------------
// View manifest (required by Sohan's auto-discovery — section 3.11)
// ---------------------------------------------------------------------------

const view = {
  id: "sar-interferograms",
  title: "Interferogram Browser",
  group: "measured" as const,
  Component: InterferogramBrowser,
};

export default view;


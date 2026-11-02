/**
 * web/src/views-sar/interferograms/__tests__/InterferogramBrowser.test.tsx
 *
 * Tests for the Interferogram Browser view.
 * Uses Vitest + Testing Library.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import view from "../index";

const { Component: InterferogramBrowser } = view;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_PROPS = {
  apiUrl: "http://localhost:8000",
  city: "delhi-ncr",
  version: 1,
  selectedFeature: null,
  flyTo: vi.fn(),
  selectFeature: vi.fn(),
};

const MOCK_RESPONSE = {
  city: "delhi-ncr",
  version: 1,
  synthetic: false,
  interferograms: [
    {
      id: "ifg-001",
      ref_date: "2021-01-05",
      sec_date: "2021-01-17",
      temporal_baseline_days: 12,
      accepted: true,
      rejection_reason: null,
      mean_coherence: 0.65,
      browse_url: null,
      sensor: "Sentinel-1",
      track: "85",
      direction: "ascending",
      looks: "20x4",
      processor: "hyp3-isce2",
      processor_version: "2.9.0",
      job_id: "abc-123",
      synthetic: false,
    },
    {
      id: "ifg-002",
      ref_date: "2021-02-10",
      sec_date: "2021-02-22",
      temporal_baseline_days: 12,
      accepted: false,
      rejection_reason: "low_coherence (0.18 < 0.30)",
      mean_coherence: 0.18,
      browse_url: null,
      sensor: "Sentinel-1",
      track: "85",
      direction: "ascending",
      looks: "20x4",
      processor: "hyp3-isce2",
      processor_version: "2.9.0",
      job_id: "def-456",
      synthetic: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InterferogramBrowser", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_RESPONSE),
      })
    );
  });

  it("renders the view title", async () => {
    render(<InterferogramBrowser {...MOCK_PROPS} />);
    expect(screen.getByText(/Interferogram Browser/i)).toBeTruthy();
  });

  it("fetches from the correct API endpoint", async () => {
    render(<InterferogramBrowser {...MOCK_PROPS} />);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:8000/cities/delhi-ncr/interferograms"
      );
    });
  });

  it("shows accepted and rejected counts", async () => {
    render(<InterferogramBrowser {...MOCK_PROPS} />);
    await waitFor(() => {
      expect(screen.getByText(/Accepted: 1/)).toBeTruthy();
      expect(screen.getByText(/Rejected: 1/)).toBeTruthy();
    });
  });

  it("shows rejection reason for rejected interferograms", async () => {
    render(<InterferogramBrowser {...MOCK_PROPS} />);
    await waitFor(() => {
      expect(screen.getByText(/low_coherence/)).toBeTruthy();
    });
  });

  it("filters to accepted only", async () => {
    render(<InterferogramBrowser {...MOCK_PROPS} />);
    await waitFor(() => screen.getByText(/Accepted: 1/));
    fireEvent.click(screen.getByText("Accepted"));
    expect(screen.queryByText(/low_coherence/)).toBeNull();
  });

  it("shows synthetic banner when data is synthetic", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...MOCK_RESPONSE, synthetic: true }),
      })
    );
    render(<InterferogramBrowser {...MOCK_PROPS} />);
    await waitFor(() => {
      expect(screen.getByText(/SYNTHETIC TEST DATA/)).toBeTruthy();
    });
  });

  it("shows error when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );
    render(<InterferogramBrowser {...MOCK_PROPS} />);
    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeTruthy();
    });
  });

  it("view manifest has correct id and group", () => {
    expect(view.id).toBe("sar-interferograms");
    expect(view.group).toBe("measured");
    expect(typeof view.Component).toBe("function");
  });
});


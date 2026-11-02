/**
 * web/src/views-science/references/__tests__/ReferencesView.test.tsx
 *
 * Unit tests for Shivani's Published Literature Validation View.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import view from "../index";

const { Component: ReferencesView } = view;

const MOCK_PROPS = {
  apiUrl: "http://localhost:8000",
  city: "delhi-ncr",
  version: 1,
  selectedFeature: null,
  flyTo: vi.fn(),
  selectFeature: vi.fn()
};

const MOCK_REFERENCES = [
  {
    citation: "Garg et al. 2022",
    url: "https://doi.org/10.1016/j.rsase.2022.100723",
    area_name: "Kapashera",
    reported_rate: -110.0,
    rate_basis: "line of sight",
    period: "2014-2020",
    method: "PSInSAR (Sentinel-1)"
  }
];

const MOCK_SUMMARY = {
  noise_floor_mm_yr: 1.25,
  fastest_rate: { value: -55.2, sigma: 2.1 },
  share_significant_motion: 0.14,
  coverage_pct: 88.5,
  significance_multiple: 3.0
};

describe("ReferencesView", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/references")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_REFERENCES) });
        }
        if (url.includes("/summary")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_SUMMARY) });
        }
        return Promise.reject(new Error("Unknown URL"));
      })
    );
  });

  it("has correct contract manifest properties", () => {
    expect(view.id).toBe("science-references");
    expect(view.group).toBe("derived");
    expect(typeof view.Component).toBe("function");
  });

  it("renders validation title and literature benchmark", async () => {
    render(<ReferencesView {...MOCK_PROPS} />);
    expect(screen.getByText(/Published Literature vs. Ours/i)).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Kapashera")).toBeTruthy();
      expect(screen.getByText("-110 mm/yr")).toBeTruthy();
      expect(screen.getByText(/Garg et al. 2022/i)).toBeTruthy();
    });
  });

  it("renders noise floor and fastest rate from summary", async () => {
    render(<ReferencesView {...MOCK_PROPS} />);
    await waitFor(() => {
      expect(screen.getByText("1.25 mm/yr")).toBeTruthy();
      expect(screen.getByText("-55.2 mm/yr")).toBeTruthy();
    });
  });
});


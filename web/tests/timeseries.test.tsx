import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimeSeriesChart } from '../src/components/chart/TimeSeriesChart';
import type { TimeSeriesResponse } from '../src/api/types';

// Mock ECharts for React in testing
vi.mock('echarts-for-react', () => ({
  default: () => <div data-testid="echarts-plot" />,
}));

describe('Task F-5: Time Series Chart & 404 Masking', () => {
  it('renders "No reliable measurement here" when API returns 404 / no_reliable_measurement', () => {
    render(
      <TimeSeriesChart
        data={null}
        isLoading={false}
        error={{ status: 404, data: { error: 'no_reliable_measurement' } }}
        lon={77.25}
        lat={28.64}
      />
    );
    expect(screen.getByText('No reliable measurement here')).toBeInTheDocument();
    expect(screen.getByText(/Temporal coherence is below threshold/)).toBeInTheDocument();
  });

  it('renders time series metrics and convention when valid measurement exists', () => {
    const validData: TimeSeriesResponse = {
      city: 'delhi-ncr',
      measured: true,
      synthetic: true,
      pixel: { lon: 77.08, lat: 28.53, coherence: 0.78 },
      unit: 'mm',
      convention: 'positive = toward satellite, line-of-sight, relative to reference point',
      series: [
        { date: '2020-01-05', value: 0.0, sigma: 1.2 },
        { date: '2020-02-05', value: -5.4, sigma: 1.3 },
      ],
      velocity: { value: -64.2, sigma: 3.2, unit: 'mm/yr' },
      seasonal_amplitude_mm: 6.8,
      provenance: {
        sensor: 'Sentinel-1',
        track: '026',
        looks: '10x2',
        mintpy: '1.5.3',
        product_version: 'v1',
      },
    };

    render(
      <TimeSeriesChart
        data={validData}
        isLoading={false}
        error={null}
        lon={77.08}
        lat={28.53}
      />
    );

    expect(screen.getByText(/Displacement Time Series/i)).toBeInTheDocument();
    expect(screen.getByText('-64.2 ± 3.2')).toBeInTheDocument();
    expect(screen.getByText('0.78')).toBeInTheDocument();
    expect(screen.getByText(/positive = toward satellite, line-of-sight/i)).toBeInTheDocument();
    expect(screen.getByTestId('echarts-plot')).toBeInTheDocument();
  });
});


import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DynamicLegend } from '../src/components/layers/DynamicLegend';
import type { LayerDefinition } from '../src/api/types';

const sampleLayers: LayerDefinition[] = [
  {
    id: 'velocity',
    label: 'Velocity (mm/yr)',
    group: 'measured',
    default_on: true,
    legend: {
      unit: 'mm/yr',
      min: -30,
      max: 10,
      palette: ['#d73027', '#fee08b', '#1a9850'],
      note: 'Line-of-sight velocity relative to reference point; positive = toward satellite.',
    },
  },
  {
    id: 'risk_index',
    label: 'Risk Screening Index',
    group: 'risk',
    default_on: false,
    legend: {
      unit: '',
      min: 0,
      max: 1,
      palette: ['#fef0d9', '#b30000'],
      note: 'Screening index, not a prediction of damage.',
    },
  },
];

describe('Task F-3: Dynamic Legend & Disclaimers', () => {
  it('renders dynamic legend properties from API response', () => {
    render(<DynamicLegend layers={sampleLayers} activeLayerIds={['velocity']} />);
    expect(screen.getByText('Velocity (mm/yr)')).toBeInTheDocument();
    expect(screen.getByText(/Line-of-sight velocity relative to reference point/)).toBeInTheDocument();
    expect(screen.getByText('-30')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders risk screening disclaimer verbatim when risk layer is active', () => {
    render(<DynamicLegend layers={sampleLayers} activeLayerIds={['risk_index']} />);
    expect(screen.getByText('Risk Screening Index')).toBeInTheDocument();
    expect(screen.getByText('Screening index, not a prediction of damage.')).toBeInTheDocument();
  });

  it('always includes the hard-coded masked pixel note: "No reliable measurement here"', () => {
    render(<DynamicLegend layers={sampleLayers} activeLayerIds={['velocity']} />);
    expect(screen.getByText(/No reliable measurement here/i)).toBeInTheDocument();
  });
});


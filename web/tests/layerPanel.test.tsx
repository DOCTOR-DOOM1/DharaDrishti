import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayerPanel } from '../src/components/layers/LayerPanel';
import type { LayerDefinition } from '../src/api/types';

const testLayers: LayerDefinition[] = [
  {
    id: 'velocity',
    label: 'Velocity (mm/yr)',
    group: 'measured',
    default_on: true,
    legend: { unit: 'mm/yr', min: -30, max: 10, palette: [] },
  },
  {
    id: 'gradient',
    label: 'Velocity Gradient',
    group: 'derived',
    default_on: false,
    legend: { unit: 'mm/yr/km', min: 0, max: 10, palette: [] },
  },
  {
    id: 'risk_index',
    label: 'Risk Screening Index',
    group: 'risk',
    default_on: false,
    legend: { unit: '', min: 0, max: 1, palette: [], note: 'Screening index, not a prediction of damage.' },
  },
];

describe('Task F-3: Layer Grouping & Risk Off-By-Default', () => {
  it('correctly partitions layers into Measured, Derived, and Risk groups', () => {
    render(
      <LayerPanel
        layers={testLayers}
        activeLayerIds={['velocity']}
        layerOpacities={{ velocity: 0.85 }}
        onToggleLayer={vi.fn()}
        onOpacityChange={vi.fn()}
      />
    );

    expect(screen.getByText('Measured InSAR')).toBeInTheDocument();
    expect(screen.getByText('Derived Science')).toBeInTheDocument();
    expect(screen.getByText('Risk (Heuristic)')).toBeInTheDocument();
    expect(screen.getByText('Screening Only')).toBeInTheDocument();
  });

  it('triggers onToggleLayer when clicking a layer toggle', () => {
    const handleToggle = vi.fn();
    render(
      <LayerPanel
        layers={testLayers}
        activeLayerIds={['velocity']}
        layerOpacities={{ velocity: 0.85 }}
        onToggleLayer={handleToggle}
        onOpacityChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Velocity Gradient'));
    expect(handleToggle).toHaveBeenCalledWith('gradient');
  });
});


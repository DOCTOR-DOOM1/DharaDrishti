import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EpochSlider } from '../src/components/timeline/EpochSlider';
import type { SnapshotItem } from '../src/api/types';

describe('Task F-9: Epoch Slider over /snapshots', () => {
  const mockSnapshots: SnapshotItem[] = [
    { epoch: '2020-01-05', tile_url: '' },
    { epoch: '2021-06-15', tile_url: '' },
    { epoch: '2023-12-28', tile_url: '' },
  ];

  it('renders snapshots and allows selecting an epoch', () => {
    const handleSelect = vi.fn();
    render(
      <EpochSlider
        snapshots={mockSnapshots}
        selectedEpoch="2021-06-15"
        onSelectEpoch={handleSelect}
      />
    );

    expect(screen.getByText('2021-06-15')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();

    // Click Next button
    const nextBtn = screen.getByLabelText('Next epoch');
    fireEvent.click(nextBtn);
    expect(handleSelect).toHaveBeenCalledWith('2023-12-28');
  });

  it('allows resetting back to full span multi-year rate', () => {
    const handleSelect = vi.fn();
    render(
      <EpochSlider
        snapshots={mockSnapshots}
        selectedEpoch="2021-06-15"
        onSelectEpoch={handleSelect}
      />
    );

    const resetBtn = screen.getByText('Full Span');
    fireEvent.click(resetBtn);
    expect(handleSelect).toHaveBeenCalledWith(null);
  });

  it('renders nothing when snapshots are empty', () => {
    const { container } = render(
      <EpochSlider snapshots={[]} selectedEpoch={null} onSelectEpoch={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});


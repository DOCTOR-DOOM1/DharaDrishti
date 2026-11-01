import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DownloadsModal } from '../src/components/downloads/DownloadsModal';

describe('Task F-11: Downloads Menu', () => {
  it('renders downloadable products and handles close event', () => {
    const handleClose = vi.fn();
    render(
      <DownloadsModal
        isOpen={true}
        onClose={handleClose}
        citySlug="delhi-ncr"
        cityName="Delhi NCR"
        isSynthetic={true}
      />
    );

    expect(screen.getByText('Download Published Products — Delhi NCR')).toBeInTheDocument();
    expect(screen.getByText('LOS Velocity Raster')).toBeInTheDocument();
    expect(screen.getByText('Subsidence Hotspots Callset')).toBeInTheDocument();
    expect(screen.getByText(/Synthetic Test Fixture Notice/)).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close download modal');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <DownloadsModal
        isOpen={false}
        onClose={vi.fn()}
        citySlug="delhi-ncr"
        cityName="Delhi NCR"
        isSynthetic={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});


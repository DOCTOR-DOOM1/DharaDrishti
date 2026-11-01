import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyntheticBanner } from '../src/components/common/SyntheticBanner';

describe('Task F-4: Synthetic Banner', () => {
  it('renders exact contract string "SYNTHETIC TEST DATA, not a measurement" when synthetic: true', () => {
    render(<SyntheticBanner isSynthetic={true} />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('SYNTHETIC TEST DATA, not a measurement');
  });

  it('renders nothing when synthetic: false', () => {
    const { container } = render(<SyntheticBanner isSynthetic={false} />);
    expect(container.firstChild).toBeNull();
  });
});


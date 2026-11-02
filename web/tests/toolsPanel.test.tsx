import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolsPanel } from '../src/components/tools/ToolsPanel';
import type { MountedViewModule, ViewProps } from '../src/api/types';

describe('Task F-2: View Shell & Auto-Discovery', () => {
  const dummyProps: ViewProps = {
    apiUrl: 'http://localhost:8000',
    city: 'delhi-ncr',
    version: 1,
    selectedFeature: null,
    flyTo: vi.fn(),
    selectFeature: vi.fn(),
  };

  it('renders placeholder message when no external views are mounted yet', () => {
    render(<ToolsPanel views={[]} loading={false} viewProps={dummyProps} />);
    expect(screen.getByText('No external views mounted yet')).toBeInTheDocument();
  });

  it('mounts and renders external view modules passing ViewProps', () => {
    const mockView: MountedViewModule = {
      id: 'interferograms-browser',
      title: 'Interferogram Browser',
      group: 'measured',
      Component: (props: ViewProps) => (
        <div data-testid="mounted-view-content">
          City: {props.city} (v{props.version})
        </div>
      ),
    };

    render(<ToolsPanel views={[mockView]} loading={false} viewProps={dummyProps} />);
    expect(screen.getByText('Interferogram Browser')).toBeInTheDocument();

    // Click to open view
    fireEvent.click(screen.getByText('Interferogram Browser'));
    expect(screen.getByTestId('mounted-view-content')).toHaveTextContent('City: delhi-ncr (v1)');
  });
});


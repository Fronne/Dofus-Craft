import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResourceDisplay } from '../../src/features/catalogue/ResourceDisplay';

const resource = { id: '8308', name: 'Peau de Gloot' };

describe('ResourceDisplay copy on click', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('copies the resource name to the clipboard and briefly confirms it', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<ResourceDisplay resource={resource} copyable />);

    fireEvent.click(screen.getByRole('button', { name: /Peau de Gloot/ }));
    await act(async () => {});

    expect(writeText).toHaveBeenCalledWith('Peau de Gloot');
    expect(screen.getByText('Copié')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.queryByText('Copié')).not.toBeInTheDocument();
  });

  it('stays plain text when not copyable', () => {
    render(<ResourceDisplay resource={resource} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Peau de Gloot')).toBeInTheDocument();
  });
});

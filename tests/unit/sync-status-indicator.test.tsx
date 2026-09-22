import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SyncStatusIndicator } from '../../src/components/SyncStatusIndicator';

describe('SyncStatusIndicator', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders nothing visible when idle, online and no known sync time', () => {
    const { container } = render(<SyncStatusIndicator isRevalidating={false} offline={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing visible when idle and online, even with a known last sync time', () => {
    const { container } = render(
      <SyncStatusIndicator isRevalidating={false} offline={false} lastSyncedAt={new Date().toISOString()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Mise à jour…" while revalidating, even if a previous attempt had failed', () => {
    render(<SyncStatusIndicator isRevalidating offline lastSyncedAt={new Date().toISOString()} />);
    expect(screen.getByText('Mise à jour…')).toBeInTheDocument();
    expect(screen.queryByText(/hors ligne/i)).not.toBeInTheDocument();
  });

  it('shows an offline message with the relative last sync time when offline and not revalidating', () => {
    const lastSyncedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    render(<SyncStatusIndicator isRevalidating={false} offline lastSyncedAt={lastSyncedAt} />);
    expect(screen.getByText(/données hors ligne/i)).toBeInTheDocument();
    expect(screen.getByText(/dernière mise à jour/i)).toBeInTheDocument();
  });

  it('shows an offline message without a time when no sync ever succeeded', () => {
    render(<SyncStatusIndicator isRevalidating={false} offline />);
    expect(screen.getByText('Données hors ligne')).toBeInTheDocument();
  });
});

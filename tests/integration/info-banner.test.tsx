import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import type { InfoMessage } from '../../src/domain/info-message';

// specs/020-info-banner, contracts/info-banner-ui.md « Bandeau ».
const getInfoMessage = vi.fn<() => Promise<InfoMessage | undefined>>();
vi.mock('../../src/services/info-message-api', () => ({ getInfoMessage: () => getInfoMessage() }));

import { InfoBanner } from '../../src/components/InfoBanner';

const message = (patch: Partial<InfoMessage> = {}): InfoMessage =>
  ({ text: 'Maintenance mardi', tone: 'info', endsAt: null, version: 'v1', ...patch });

function renderSite() {
  // StrictMode, like the real app: its double mount must not swallow the first load.
  return render(
    <StrictMode><MemoryRouter>
      <InfoBanner />
      <Routes>
        <Route path="/" element={<Link to="/prix">Prix</Link>} />
        <Route path="/prix" element={<p>Page Prix</p>} />
      </Routes>
    </MemoryRouter></StrictMode>,
  );
}

describe('InfoBanner (specs/020)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getInfoMessage.mockReset();
  });
  afterEach(() => {
    cleanup();
  });

  it('shows nothing without a message, or when it cannot be loaded (FR-008)', async () => {
    getInfoMessage.mockResolvedValue(undefined);
    renderSite();
    await act(async () => {});
    expect(screen.queryByText('Maintenance mardi')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Prix' })).toBeInTheDocument();
  });

  it('does not reload the message on each page change', async () => {
    getInfoMessage.mockResolvedValue(message());
    renderSite();
    await screen.findByRole('status');
    const calls = getInfoMessage.mock.calls.length;
    fireEvent.click(screen.getByRole('link', { name: 'Prix' }));
    await act(async () => {});
    expect(getInfoMessage).toHaveBeenCalledTimes(calls);
  });

  it('shows an Info message as a status, on every page, as plain text', async () => {
    getInfoMessage.mockResolvedValue(message({ text: '<b>Maintenance</b> mardi' }));
    renderSite();
    const banner = await screen.findByRole('status');
    expect(banner).toHaveClass('info-banner--info');
    expect(banner).toHaveTextContent('<b>Maintenance</b> mardi');
    expect(banner.querySelector('b')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Prix' }));
    expect(screen.getByText('Page Prix')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('mardi');
  });

  it('shows an Important message as an alert', async () => {
    getInfoMessage.mockResolvedValue(message({ tone: 'important' }));
    renderSite();
    expect(await screen.findByRole('alert')).toHaveClass('info-banner--important');
  });

  it('stays closed for that version, and comes back for a new one (FR-004, FR-005)', async () => {
    getInfoMessage.mockResolvedValue(message());
    renderSite();
    fireEvent.click(await screen.findByRole('button', { name: 'Fermer le message' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    cleanup();

    renderSite();
    await act(async () => {});
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    cleanup();

    getInfoMessage.mockResolvedValue(message({ text: 'Nouveau message', version: 'v2' }));
    renderSite();
    expect(await screen.findByRole('status')).toHaveTextContent('Nouveau message');
  });

  it('hides the banner when its end date comes while the page is open (FR-006)', async () => {
    // Real time, a second and a half ahead: simulated clocks proved unreliable under a loaded test run.
    getInfoMessage.mockResolvedValue(message({ endsAt: new Date(Date.now() + 1500).toISOString() }));
    renderSite();
    expect(await screen.findByRole('status')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument(), { timeout: 4000 });
  });
});

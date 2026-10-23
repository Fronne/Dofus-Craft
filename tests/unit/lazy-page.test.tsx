import { Component, Suspense, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lazyPage } from '../../src/app/lazy-page';

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p>failed</p> : this.props.children; }
}

function renderPage(load: () => Promise<{ default: () => ReactNode }>) {
  const Page = lazyPage(load);
  return render(<Boundary><Suspense fallback={<p>loading</p>}><Page /></Suspense></Boundary>);
}

describe('lazyPage', () => {
  const reload = vi.fn();
  const realLocation = window.location;

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, reload } });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
    vi.restoreAllMocks();
  });

  it('renders the page once loaded', async () => {
    renderPage(() => Promise.resolve({ default: () => <p>page</p> }));
    expect(await screen.findByText('page')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads once when the chunk cannot be fetched, staying on the fallback', async () => {
    renderPage(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('shows the error instead of reloading again once it already reloaded', async () => {
    sessionStorage.setItem('lazy-page-reloaded', '1');
    renderPage(() => Promise.reject(new Error('boom')));
    expect(await screen.findByText('failed')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FmMe } from '../../src/domain/forgemagie';

// specs/075-connexion-discord-site (US1, US2): the account at the right end of the bar, on any page.
const fm = vi.hoisted(() => ({ getFmMe: vi.fn(), updateFmMe: vi.fn(), logoutFm: vi.fn() }));
vi.mock('../../src/services/fm-api', () => ({ ...fm, fmLoginUrl: (returnPath?: string) => `https://api.test/fm/auth/login?return_path=${returnPath ?? ''}` }));
vi.mock('../../src/app/ServerContext', () => ({ useActiveServer: () => ({ serverId: 'mikhal' }) }));

import { AccountMenu } from '../../src/app/AccountMenu';
import { AuthProvider } from '../../src/app/AuthContext';
import { FM_SESSION_TOKEN_KEY, readFmSessionToken, writeFmSessionToken } from '../../src/persistence/fm-session-token';

const TOKEN = 'b'.repeat(64);
const me: FmMe = {
  discordUserId: '42', displayName: 'Cyril', avatarUrl: 'https://cdn.test/avatar.png', serverId: 'mikhal', isPrivate: false,
  firstLoginAt: null, guildName: null, breedId: null, isMember: false,
};
const ok = <T,>(data: T) => ({ status: 'ok', data });

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function open(path = '/hdv') {
  window.history.replaceState(null, '', path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AccountMenu />
        <Where />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  Object.values(fm).forEach((mock) => mock.mockReset());
  fm.getFmMe.mockResolvedValue(ok(me));
  fm.updateFmMe.mockImplementation(async (changes: Partial<FmMe>) => ok({ ...me, ...changes }));
  fm.logoutFm.mockResolvedValue(ok(undefined));
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('a visitor', () => {
  it('sees the Discord login, which comes back to the page they are on, and nothing is asked of the Worker', () => {
    open('/hdv');
    expect(screen.getByRole('link', { name: 'Se connecter avec Discord' })).toHaveAttribute('href', 'https://api.test/fm/auth/login?return_path=/hdv');
    expect(fm.getFmMe).not.toHaveBeenCalled();
  });
});

describe('the login coming back from Discord', () => {
  it('keeps the session once, removes it from the address and shows the player — member of the group\'s server or not', async () => {
    open(`/hdv#session=${TOKEN}`);
    expect(await screen.findByRole('button', { name: 'Compte de Cyril' })).toBeInTheDocument();
    expect(readFmSessionToken()).toBe(TOKEN);
    expect(window.location.hash).toBe('');
    expect(fm.getFmMe).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says a refusal on Discord, leaves the visitor logged out and lets the message be closed', async () => {
    open('/hdv#error=cancelled');
    expect(screen.getByRole('alert')).toHaveTextContent('Connexion annulée');
    expect(window.location.hash).toBe('');
    expect(screen.getByRole('link', { name: 'Se connecter avec Discord' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le message' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says a failure, with a way to try again', async () => {
    open('/hdv#error=login-failed');
    expect(screen.getByRole('alert')).toHaveTextContent('La connexion a échoué');
    expect(screen.getByRole('link', { name: 'Se connecter avec Discord' })).toBeInTheDocument();
  });

  it('leaves another hash of the address alone', () => {
    open('/hdv#contenu');
    expect(window.location.hash).toBe('#contenu');
  });
});

describe('a logged-in player', () => {
  beforeEach(() => writeFmSessionToken(TOKEN));

  it('sees their Discord name and avatar, and the class icon they chose', async () => {
    fm.getFmMe.mockResolvedValue(ok({ ...me, breedId: 8 }));
    open();
    const button = await screen.findByRole('button', { name: 'Compte de Cyril' });
    expect(button).toHaveTextContent('Cyril');
    expect(button.querySelector('img.account-avatar')).toHaveAttribute('src', 'https://cdn.test/avatar.png');
    expect(button.querySelector('img.account-breed')).toHaveAttribute('src', '/class-heads/Head_80.png');
    expect(screen.queryByRole('link', { name: 'Se connecter avec Discord' })).not.toBeInTheDocument();
  });

  it('has the initial of their name when Discord gave no avatar, and no class icon when none is chosen', async () => {
    fm.getFmMe.mockResolvedValue(ok({ ...me, avatarUrl: null }));
    open();
    const button = await screen.findByRole('button', { name: 'Compte de Cyril' });
    expect(button.querySelector('img')).toBeNull();
    expect(button.querySelector('.account-avatar--empty')).toHaveTextContent('C');
  });

  it('opens a menu with the profile and the logout, which Escape closes', async () => {
    open();
    const button = await screen.findByRole('button', { name: 'Compte de Cyril' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Mon profil' })).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Mon profil' })).toHaveAttribute('href', '/profil');
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('link', { name: 'Mon profil' })).not.toBeInTheDocument();
  });

  it('goes to the profile page from the menu', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Compte de Cyril' }));
    fireEvent.click(screen.getByRole('link', { name: 'Mon profil' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/profil');
    expect(screen.queryByRole('link', { name: 'Mon profil' })).not.toBeInTheDocument();
  });

  it('logs out: the Worker is told, the token goes, the login comes back — and stays after a new load', async () => {
    const { unmount } = open();
    fireEvent.click(await screen.findByRole('button', { name: 'Compte de Cyril' }));
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    await screen.findByRole('link', { name: 'Se connecter avec Discord' });
    expect(fm.logoutFm).toHaveBeenCalledTimes(1);
    expect(readFmSessionToken()).toBeUndefined();

    unmount();
    fm.getFmMe.mockClear();
    open();
    expect(screen.getByRole('link', { name: 'Se connecter avec Discord' })).toBeInTheDocument();
    expect(fm.getFmMe).not.toHaveBeenCalled();
  });

  it('is a visitor again when the session expired', async () => {
    fm.getFmMe.mockResolvedValue({ status: 'unauthorized' });
    open();
    await screen.findByRole('link', { name: 'Se connecter avec Discord' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('is a visitor here too once the token is removed in another tab', async () => {
    open();
    await screen.findByRole('button', { name: 'Compte de Cyril' });
    window.localStorage.removeItem(FM_SESSION_TOKEN_KEY);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: FM_SESSION_TOKEN_KEY, newValue: null }));
    });
    await screen.findByRole('link', { name: 'Se connecter avec Discord' });
  });

  it('keeps the visitor\'s login when the Worker does not answer, without a message', async () => {
    fm.getFmMe.mockResolvedValue({ status: 'unavailable' });
    open();
    await waitFor(() => expect(fm.getFmMe).toHaveBeenCalled());
    expect(await screen.findByRole('link', { name: 'Se connecter avec Discord' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(readFmSessionToken()).toBe(TOKEN);
  });

  it('files the profile on the site\'s server when it is on another', async () => {
    fm.getFmMe.mockResolvedValue(ok({ ...me, serverId: 'draconiros' }));
    open();
    await screen.findByRole('button', { name: 'Compte de Cyril' });
    await waitFor(() => expect(fm.updateFmMe).toHaveBeenCalledWith({ serverId: 'mikhal' }));
    expect(within(document.body).getByRole('button', { name: 'Compte de Cyril' })).toBeInTheDocument();
  });
});

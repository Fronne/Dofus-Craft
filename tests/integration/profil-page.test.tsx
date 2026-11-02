import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BREEDS } from '../../src/domain/breeds';
import type { FmMe } from '../../src/domain/forgemagie';

// specs/075-connexion-discord-site (US3): the profile page — who the player is, their class icon, the deletion.
const fm = vi.hoisted(() => ({ getFmMe: vi.fn(), updateFmMe: vi.fn(), deleteFmMe: vi.fn(), logoutFm: vi.fn() }));
vi.mock('../../src/services/fm-api', () => ({ ...fm, fmLoginUrl: (returnPath?: string) => `https://api.test/fm/auth/login?return_path=${returnPath ?? ''}` }));
vi.mock('../../src/app/ServerContext', () => ({ useActiveServer: () => ({ serverId: 'mikhal' }) }));

import { AccountMenu } from '../../src/app/AccountMenu';
import { AuthProvider } from '../../src/app/AuthContext';
import { ProfilPage } from '../../src/features/account/ProfilPage';
import { readFmSessionToken, writeFmSessionToken } from '../../src/persistence/fm-session-token';

const me: FmMe = {
  discordUserId: '42', displayName: 'Cyril', avatarUrl: null, serverId: 'mikhal', isPrivate: false,
  firstLoginAt: null, guildName: 'Les Forgemages', breedId: null, isMember: true,
};
const ok = <T,>(data: T) => ({ status: 'ok', data });

function open() {
  return render(
    <MemoryRouter initialEntries={['/profil']}>
      <AuthProvider>
        <AccountMenu />
        <ProfilPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  Object.values(fm).forEach((mock) => mock.mockReset());
  fm.getFmMe.mockResolvedValue(ok(me));
  fm.updateFmMe.mockImplementation(async (changes: Partial<FmMe>) => ok({ ...me, ...changes }));
  fm.deleteFmMe.mockResolvedValue(ok(undefined));
  fm.logoutFm.mockResolvedValue(ok(undefined));
});
afterEach(cleanup);

describe('the profile page of a visitor', () => {
  it('invites them to log in, coming back to the profile', () => {
    open();
    expect(screen.getByRole('heading', { name: 'Mon profil' })).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Se connecter avec Discord' });
    expect(links.at(-1)).toHaveAttribute('href', 'https://api.test/fm/auth/login?return_path=/profil');
    expect(screen.queryByRole('group', { name: 'Classe' })).not.toBeInTheDocument();
  });
});

describe('the profile page of a logged-in player', () => {
  beforeEach(() => writeFmSessionToken('c'.repeat(64)));

  it('shows who they are, from Discord, and that the Forgemagie is open to them', async () => {
    open();
    expect(await screen.findByText('Ton pseudo et ton avatar viennent de Discord.')).toBeInTheDocument();
    expect(screen.getByText(/Tu es membre du serveur Discord « Les Forgemages » : la page Forgemagie t'est ouverte\./)).toBeInTheDocument();
    expect(screen.getByText('Aucune icône choisie')).toBeInTheDocument();
  });

  it('says that the Forgemagie is closed to a player who is not a member of the group\'s server', async () => {
    fm.getFmMe.mockResolvedValue(ok({ ...me, isMember: false }));
    open();
    expect(await screen.findByText(/Tu n'es pas membre du serveur Discord du groupe : la page Forgemagie lui est réservée\./)).toBeInTheDocument();
  });

  it('offers the 19 classes', async () => {
    open();
    const group = await screen.findByRole('group', { name: 'Classe' });
    expect(within(group).getAllByRole('button')).toHaveLength(BREEDS.length);
    expect(within(group).getByRole('button', { name: 'Iop' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('chooses a class: it is saved, shown on the page and on the bar', async () => {
    open();
    fireEvent.click(await within(await screen.findByRole('group', { name: 'Classe' })).findByRole('button', { name: 'Iop' }));
    await waitFor(() => expect(fm.updateFmMe).toHaveBeenCalledWith({ breedId: 8 }));
    expect(await screen.findByText('Iop', { selector: 'b' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Classe' })).getByRole('button', { name: 'Iop' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Compte de Cyril' }).querySelector('img.account-breed')).toHaveAttribute('src', '/class-heads/Head_80.png');
  });

  it('changes the class, then removes the icon', async () => {
    fm.getFmMe.mockResolvedValue(ok({ ...me, breedId: 8 }));
    open();
    const group = await screen.findByRole('group', { name: 'Classe' });
    expect(within(group).getByRole('button', { name: 'Iop' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(group).getByRole('button', { name: 'Crâ' }));
    await waitFor(() => expect(fm.updateFmMe).toHaveBeenLastCalledWith({ breedId: 9 }));

    fireEvent.click(await screen.findByRole('button', { name: 'Retirer mon icône' }));
    await waitFor(() => expect(fm.updateFmMe).toHaveBeenLastCalledWith({ breedId: null }));
    expect(await screen.findByText('Aucune icône choisie')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compte de Cyril' }).querySelector('img.account-breed')).toBeNull();
  });

  it('has nothing to remove when no icon is chosen', async () => {
    open();
    expect(await screen.findByRole('button', { name: 'Retirer mon icône' })).toBeDisabled();
  });

  it('falls back on the class\'s initial when its portrait does not load', async () => {
    open();
    const iop = within(await screen.findByRole('group', { name: 'Classe' })).getByRole('button', { name: 'Iop' });
    fireEvent.error(iop.querySelector('img')!);
    expect(iop.querySelector('.breed-portrait--empty')).toHaveTextContent('I');
  });

  it('says when the icon could not be saved, and changes nothing', async () => {
    fm.updateFmMe.mockResolvedValue({ status: 'unavailable' });
    open();
    fireEvent.click(await within(await screen.findByRole('group', { name: 'Classe' })).findByRole('button', { name: 'Iop' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('L\'icône n\'a pas pu être enregistrée');
    expect(screen.getByText('Aucune icône choisie')).toBeInTheDocument();
  });

  it('deletes the profile only after a confirmation, then is a visitor', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer mon profil' }));
    const dialog = screen.getByRole('dialog', { name: 'Supprimer mon profil', hidden: true });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler', hidden: true }));
    expect(fm.deleteFmMe).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon profil' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer définitivement', hidden: true }));
    await waitFor(() => expect(fm.deleteFmMe).toHaveBeenCalledTimes(1));
    await screen.findAllByRole('link', { name: 'Se connecter avec Discord' });
    expect(readFmSessionToken()).toBeUndefined();
  });
});

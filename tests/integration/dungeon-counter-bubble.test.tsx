import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerCounter } from '../../src/domain/player-counter';

const getPlayerCounters = vi.fn();
vi.mock('../../src/services/player-counters-api', () => ({
  getPlayerCounters: (...args: unknown[]) => getPlayerCounters(...args),
}));

import { PlayerCounters } from '../../src/features/dungeon-counter/DungeonCounterBubble';

const lanceur: PlayerCounter = {
  id: 'le-lanceurdeglyphe',
  player: 'Le-Lanceurdeglyphe',
  breedId: 1,
  sex: 'm',
  count: 150,
  atLeast: true,
  unitOne: 'donjon sans drop',
  unitMany: 'donjons sans drop',
  target: { itemId: 21189, name: 'Parangon de puissance', icon: 'https://api.dofusdb.fr/img/items/50733.png' },
  createdAt: '2026-09-24T00:00:00.000Z',
  updatedAt: '2026-09-24T00:00:00.000Z',
};
const nicomoux: PlayerCounter = {
  ...lanceur,
  id: 'nicomoux',
  player: 'Nicomoux',
  breedId: 12,
  count: 157,
  atLeast: false,
  unitOne: 'tentative de FM',
  unitMany: 'tentatives de FM',
  target: { itemId: 14094, name: 'Amulette du Strigide', icon: 'https://api.dofusdb.fr/img/items/1235.png' },
  createdAt: '2026-09-24T00:00:01.000Z',
};

const DUNGEONS = 'Compteur de donjons sans drop de Le-Lanceurdeglyphe';
const FM = 'Compteur de tentatives de FM de Nicomoux';

async function renderCounters() {
  render(<PlayerCounters />);
  await act(async () => {});
}

describe('bulles de compteurs lues depuis la base (specs/013, specs/014)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getPlayerCounters.mockReset().mockResolvedValue({ status: 'ok', counters: [lanceur, nicomoux] });
  });
  afterEach(() => cleanup());

  it('shows one portrait per stored counter, all closed (FR-001, FR-003)', async () => {
    await renderCounters();
    expect(screen.getByRole('button', { name: DUNGEONS })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: FM })).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the player, class, count and target of a counter', async () => {
    await renderCounters();
    fireEvent.click(screen.getByRole('button', { name: DUNGEONS }));
    const dialog = screen.getByRole('dialog', { name: DUNGEONS });
    expect(dialog).toHaveTextContent('Le-Lanceurdeglyphe');
    expect(dialog).toHaveTextContent('Féca');
    expect(dialog).toHaveTextContent('150+donjons sans drop');
    expect(dialog).toHaveTextContent('Parangon de puissance');
    expect(dialog.querySelector('img')).toHaveAttribute('src', '/class-heads/Head_10.png');
  });

  it('shows the Pandawa portrait and singular/plural from the stored counter', async () => {
    getPlayerCounters.mockResolvedValue({ status: 'ok', counters: [{ ...nicomoux, count: 1 }] });
    await renderCounters();
    fireEvent.click(screen.getByRole('button', { name: FM }));
    const dialog = screen.getByRole('dialog', { name: FM });
    expect(dialog).toHaveTextContent('Pandawa');
    expect(dialog).toHaveTextContent('1tentative de FM');
    expect(dialog.querySelector('img')).toHaveAttribute('src', '/class-heads/Head_120.png');
  });

  it('keeps only one bubble open at a time', async () => {
    await renderCounters();
    fireEvent.click(screen.getByRole('button', { name: DUNGEONS }));
    const fmButton = screen.getByRole('button', { name: FM });
    fireEvent.pointerDown(fmButton);
    fireEvent.click(fmButton);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('closes with the close button, Escape, or a click outside', async () => {
    await renderCounters();
    const open = () => fireEvent.click(screen.getByRole('button', { name: DUNGEONS }));
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    open();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the last list received when the service is down (FR-004)', async () => {
    window.localStorage.setItem('craftcheck-player-counters', JSON.stringify([nicomoux]));
    getPlayerCounters.mockResolvedValue({ status: 'unavailable' });
    await renderCounters();
    expect(screen.getByRole('button', { name: FM })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: DUNGEONS })).not.toBeInTheDocument();
  });

  it('shows no bubble at all when nothing is known (FR-004)', async () => {
    getPlayerCounters.mockResolvedValue({ status: 'unavailable' });
    await renderCounters();
    expect(screen.queryByRole('button', { name: /Compteur de/ })).not.toBeInTheDocument();
  });

  it('remembers the list for next time', async () => {
    await renderCounters();
    expect(JSON.parse(window.localStorage.getItem('craftcheck-player-counters') ?? '[]')).toHaveLength(2);
  });

  it('offers nothing to edit on the public site (FR-008)', async () => {
    await renderCounters();
    fireEvent.click(screen.getByRole('button', { name: DUNGEONS }));
    expect(screen.queryByRole('button', { name: /Modifier|Enregistrer|Supprimer/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// specs/073-admin-nettoyage-donnees (contracts/admin-data-api.md « Interface »).
const api = vi.hoisted(() => ({
  getCleanup: vi.fn(),
  listCleanupRows: vi.fn(),
  countCleanup: vi.fn(),
  deleteCleanup: vi.fn(),
}));
vi.mock('../../admin/admin-api', () => ({ adminApi: api }));

import { DataCleanupEditor } from '../../admin/DataCleanupEditor';

const tables = [
  { id: 'brisage-coefficients', label: 'Coefficients de brisage', columns: [{ id: 'server_id', label: 'Serveur' }, { id: 'coefficient', label: 'Coefficient' }], filters: ['server'] },
  { id: 'prix-communaute', label: 'Prix de la communauté', columns: [{ id: 'origin', label: 'Origine' }], filters: ['server', 'origin'] },
];
const row = (key: string, date: string, coefficient = 110) => ({ key, date, cells: { server_id: 'mikhal', coefficient } });
const rowsOf = [row('3', '2026-10-23T10:03:00.000Z'), row('2', '2026-10-23T10:02:00.000Z'), row('1', '2026-10-23T10:01:00.000Z')];
const ok = <T,>(value: T) => ({ status: 'ok' as const, value });

async function renderEditor() {
  render(<DataCleanupEditor />);
  await act(async () => {});
}

const checkboxes = () => screen.getAllByRole('checkbox');

beforeEach(() => {
  api.getCleanup.mockResolvedValue(ok({ tables, log: [] }));
  api.listCleanupRows.mockResolvedValue(ok(rowsOf));
  api.countCleanup.mockResolvedValue(ok({ count: 37, limit: 500 }));
  api.deleteCleanup.mockResolvedValue(ok({ deleted: 2, logged: true }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('user story 1 — rows to tick and delete', () => {
  it('lists the rows of the first table, most recent first', async () => {
    await renderEditor();
    expect(api.listCleanupRows).toHaveBeenCalledWith('brisage-coefficients', { server: '', origin: '' });
    expect(checkboxes()).toHaveLength(3);
    expect(screen.getByRole('columnheader', { name: 'Coefficient' })).toBeInTheDocument();
  });

  it('disables the deletion until a row is ticked, asks for a confirmation and deletes only on Confirm', async () => {
    await renderEditor();
    const remove = screen.getByRole('button', { name: 'Supprimer la sélection' });
    expect(remove).toBeDisabled();

    fireEvent.click(checkboxes()[0]);
    fireEvent.click(checkboxes()[1]);
    fireEvent.click(remove);
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/Supprimer 2 lignes \?/)).toBeInTheDocument();
    expect(api.deleteCleanup).not.toHaveBeenCalled();

    api.listCleanupRows.mockResolvedValue(ok([rowsOf[2]]));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer' }));
    });
    expect(api.deleteCleanup).toHaveBeenCalledWith('brisage-coefficients', { keys: ['3', '2'] });
    expect(screen.getByRole('status')).toHaveTextContent('2 lignes supprimées.');
    expect(checkboxes()).toHaveLength(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(api.getCleanup).toHaveBeenCalledTimes(2);
  });

  it('deletes nothing when the confirmation is cancelled', async () => {
    await renderEditor();
    fireEvent.click(checkboxes()[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la sélection' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(api.deleteCleanup).not.toHaveBeenCalled();
  });

  it('says there is no row and offers no deletion for an empty table', async () => {
    api.listCleanupRows.mockResolvedValue(ok([]));
    await renderEditor();
    expect(screen.getByText('Aucune ligne.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Supprimer la sélection' })).not.toBeInTheDocument();
  });

  it('shows the origin filter only for the community prices and applies it', async () => {
    await renderEditor();
    expect(screen.queryByLabelText('Origine')).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Table'), { target: { value: 'prix-communaute' } });
    });
    expect(api.listCleanupRows).toHaveBeenLastCalledWith('prix-communaute', { server: '', origin: '' });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Origine'), { target: { value: 'sniffer' } });
    });
    expect(api.listCleanupRows).toHaveBeenLastCalledWith('prix-communaute', { server: '', origin: 'sniffer' });
    fireEvent.change(screen.getByLabelText('Serveur'), { target: { value: ' Mikhal ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }));
    });
    expect(api.listCleanupRows).toHaveBeenLastCalledWith('prix-communaute', { server: 'mikhal', origin: 'sniffer' });
  });

  it('shows a failure to read the rows', async () => {
    api.listCleanupRows.mockResolvedValue({ status: 'unavailable' });
    await renderEditor();
    expect(screen.getByRole('alert')).toHaveTextContent('Enregistrement impossible pour le moment.');
  });
});

describe('user story 2 — everything newer than a duration', () => {
  it('previews the exact count, then deletes with it on Confirm', async () => {
    await renderEditor();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '24 heures' }));
    });
    expect(api.countCleanup).toHaveBeenCalledWith('brisage-coefficients', '24h', { server: '', origin: '' });
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/Supprimer 37 lignes de moins de 24 heures \?/)).toBeInTheDocument();
    expect(api.deleteCleanup).not.toHaveBeenCalled();

    api.deleteCleanup.mockResolvedValue(ok({ deleted: 37, logged: true }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer' }));
    });
    expect(api.deleteCleanup).toHaveBeenCalledWith('brisage-coefficients', { since: '24h', expectedCount: 37, server: undefined, origin: undefined });
    expect(screen.getByRole('status')).toHaveTextContent('37 lignes supprimées.');
  });

  it('cancels without deleting', async () => {
    await renderEditor();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '1 heure' }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(api.deleteCleanup).not.toHaveBeenCalled();
  });

  it('says so, without a confirmation, when no row is concerned', async () => {
    api.countCleanup.mockResolvedValue(ok({ count: 0, limit: 500 }));
    await renderEditor();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '10 minutes' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Aucune ligne de moins de 10 minutes.');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('refuses more than the limit and asks to narrow down', async () => {
    api.countCleanup.mockResolvedValue(ok({ count: 812, limit: 500 }));
    await renderEditor();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '24 heures' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('812 lignes concernées : une suppression porte sur 500 lignes au plus');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it("shows the server's refusal when the count changed", async () => {
    await renderEditor();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '1 heure' }));
    });
    api.deleteCleanup.mockResolvedValue({ status: 'invalid', field: '', error: 'Le nombre de lignes a changé (40 au lieu de 37) : relancez l\'aperçu.' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Le nombre de lignes a changé');
  });
});

describe('user story 3 — the trace', () => {
  it('says so when nothing was deleted yet', async () => {
    await renderEditor();
    expect(screen.getByText("Aucune suppression pour l'instant.")).toBeInTheDocument();
  });

  it('lists the latest deletions with their table, count, mode and filter', async () => {
    api.getCleanup.mockResolvedValue(ok({
      tables,
      log: [
        { id: 2, deletedAt: '2026-10-23T09:12:00.000Z', table: 'prix-communaute', mode: 'duration', filter: 'durée 1h · origine sniffer', count: 37 },
        { id: 1, deletedAt: '2026-10-22T09:12:00.000Z', table: 'brisage-coefficients', mode: 'selection', filter: '', count: 1 },
      ],
    }));
    await renderEditor();
    expect(screen.getByText('37 lignes · Prix de la communauté')).toBeInTheDocument();
    expect(screen.getByText(/par durée · durée 1h · origine sniffer/)).toBeInTheDocument();
    expect(screen.getByText('1 ligne · Coefficients de brisage')).toBeInTheDocument();
  });

  it('warns when the trace could not be written', async () => {
    api.deleteCleanup.mockResolvedValue(ok({ deleted: 1, logged: false }));
    await renderEditor();
    fireEvent.click(checkboxes()[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la sélection' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent("1 ligne supprimée (la trace n'a pas pu être enregistrée).");
  });
});

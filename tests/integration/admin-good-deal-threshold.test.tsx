import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// specs/078-bons-plans-hdv (US4): the threshold field of the administration page.
const api = vi.hoisted(() => ({ getGoodDealThreshold: vi.fn(), saveGoodDealThreshold: vi.fn() }));
vi.mock('../../admin/admin-api', () => ({ adminApi: api }));

import { GoodDealThresholdEditor } from '../../admin/GoodDealThresholdEditor';

beforeEach(() => {
  api.getGoodDealThreshold.mockReset().mockResolvedValue({ status: 'ok', value: 25 });
  api.saveGoodDealThreshold.mockReset();
});

afterEach(cleanup);

describe('seuil des bons plans', () => {
  it('shows the saved value and keeps Enregistrer off until it changes', async () => {
    render(<GoodDealThresholdEditor />);
    const input = (await screen.findByLabelText(/Seuil \(%\)/)) as HTMLInputElement;
    expect(input.value).toBe('25');
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  it('saves the new value and shows the one the server answered', async () => {
    api.saveGoodDealThreshold.mockResolvedValue({ status: 'ok', value: 40 });
    render(<GoodDealThresholdEditor />);
    fireEvent.change(await screen.findByLabelText(/Seuil \(%\)/), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Seuil enregistré : 40 %.')).toBeInTheDocument();
    expect(api.saveGoodDealThreshold).toHaveBeenCalledWith(40);
  });

  it.each(['4', '91', '', '12.5'])('does not allow saving %j', async (value) => {
    render(<GoodDealThresholdEditor />);
    fireEvent.change(await screen.findByLabelText(/Seuil \(%\)/), { target: { value } });
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    expect(api.saveGoodDealThreshold).not.toHaveBeenCalled();
  });

  it('says when saving failed and keeps the saved value', async () => {
    api.saveGoodDealThreshold.mockResolvedValue({ status: 'unavailable' });
    render(<GoodDealThresholdEditor />);
    fireEvent.change(await screen.findByLabelText(/Seuil \(%\)/), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await waitFor(() => expect((screen.getByLabelText(/Seuil \(%\)/) as HTMLInputElement).value).toBe('40'));
  });

  it('offers nothing to edit when the value could not be read', async () => {
    api.getGoodDealThreshold.mockResolvedValue({ status: 'unavailable' });
    render(<GoodDealThresholdEditor />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Seuil \(%\)/)).not.toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { createFmWorker } from '../support/fm-worker';

// specs/075-connexion-discord-site (US3, FR-010, FR-011): the class icon of the profile.
describe('PATCH /fm/me with a class icon', () => {
  it('chooses a class, changes it and removes it', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    expect(await (await fm.call('GET', '/fm/me', { token })).json()).toMatchObject({ breedId: null });

    const chosen = await fm.call('PATCH', '/fm/me', { token, body: { breedId: 8 } });
    expect(chosen.status).toBe(200);
    expect(await chosen.json()).toMatchObject({ breedId: 8 });
    expect(await (await fm.call('PATCH', '/fm/me', { token, body: { breedId: 20 } })).json()).toMatchObject({ breedId: 20 });
    expect(await (await fm.call('PATCH', '/fm/me', { token, body: { breedId: null } })).json()).toMatchObject({ breedId: null });
    expect(fm.query('SELECT breed_id FROM fm_players')).toEqual([{ breed_id: null }]);
  });

  it('keeps the class when another setting changes', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    await fm.call('PATCH', '/fm/me', { token, body: { breedId: 3 } });
    expect(await (await fm.call('PATCH', '/fm/me', { token, body: { isPrivate: true } })).json()).toMatchObject({ breedId: 3, isPrivate: true });
  });

  it('refuses an unknown class and changes nothing', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    await fm.call('PATCH', '/fm/me', { token, body: { breedId: 8 } });
    for (const breedId of [19, 0, 21, '8', 1.5, true]) {
      expect((await fm.call('PATCH', '/fm/me', { token, body: { breedId } })).status, String(breedId)).toBe(400);
    }
    expect(fm.query('SELECT breed_id FROM fm_players')).toEqual([{ breed_id: 8 }]);
  });

  it('works for a player who is not a member of the group\'s server', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42', { isMember: false });
    expect(await (await fm.call('PATCH', '/fm/me', { token, body: { breedId: 5 } })).json()).toMatchObject({ breedId: 5, isMember: false });
  });

  it('goes with the profile when it is deleted', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    await fm.call('PATCH', '/fm/me', { token, body: { breedId: 5 } });
    expect((await fm.call('DELETE', '/fm/me', { token })).status).toBe(204);
    expect(fm.query('SELECT breed_id FROM fm_players')).toEqual([]);
  });
});

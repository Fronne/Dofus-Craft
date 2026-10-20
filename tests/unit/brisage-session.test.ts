import { beforeEach, describe, expect, it } from 'vitest';
import { getBrisageSession, setBrisageSession } from '../../src/persistence/brisage-session';

// specs/061-simplification-page-brisage: the page comes back as it was after a reload.
describe('brisage-session', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips', () => {
    const session = {
      serverId: 'mikhal', item: { id: '777', name: 'Cape', level: 100, imageUrl: undefined },
      rolls: { 0: '44' }, coefficientText: '150', manualCost: '5000', priceSource: 'craft' as const,
    };
    setBrisageSession(session);
    expect(getBrisageSession()).toEqual(session);
  });

  it('forgets the session when cleared', () => {
    setBrisageSession({ serverId: 'mikhal', item: { id: '1', name: 'A' }, rolls: {}, coefficientText: '', manualCost: '', priceSource: 'hdv' });
    setBrisageSession(undefined);
    expect(getBrisageSession()).toBeUndefined();
  });

  it('ignores corrupted or wrong-typed storage and drops wrong-typed rolls', () => {
    window.localStorage.setItem('craftcheck-brisage-session', '{oops');
    expect(getBrisageSession()).toBeUndefined();
    window.localStorage.setItem('craftcheck-brisage-session', JSON.stringify({ serverId: 'm', item: { id: 5, name: 'A' } }));
    expect(getBrisageSession()).toBeUndefined();
    window.localStorage.setItem('craftcheck-brisage-session', JSON.stringify({ serverId: 'm', item: { id: '1', name: 'A' }, rolls: { 0: 3, 1: '7' }, coefficientText: 9 }));
    expect(getBrisageSession()).toEqual({ serverId: 'm', item: { id: '1', name: 'A', level: undefined, imageUrl: undefined }, rolls: { 1: '7' }, coefficientText: '', manualCost: '', priceSource: 'hdv' });
  });

  // specs/062-prix-objet-brisage (FR-007): a session saved before the price source existed comes back on HDV.
  it('reads a session saved without a price source, or with an unknown one, as HDV', () => {
    const base = { serverId: 'm', item: { id: '1', name: 'A' }, rolls: {}, coefficientText: '', manualCost: '' };
    window.localStorage.setItem('craftcheck-brisage-session', JSON.stringify(base));
    expect(getBrisageSession()?.priceSource).toBe('hdv');
    window.localStorage.setItem('craftcheck-brisage-session', JSON.stringify({ ...base, priceSource: 'autre' }));
    expect(getBrisageSession()?.priceSource).toBe('hdv');
  });

  // specs/065-refonte-page-brisage: the price source can also be Auto (the cheaper of buying and crafting).
  it('round-trips Auto and keeps HDV and craft as they were saved', () => {
    for (const priceSource of ['auto', 'hdv', 'craft'] as const) {
      const session = { serverId: 'm', item: { id: '1', name: 'A', level: undefined, imageUrl: undefined }, rolls: {}, coefficientText: '', manualCost: '', priceSource };
      setBrisageSession(session);
      expect(getBrisageSession()).toEqual(session);
    }
  });
});

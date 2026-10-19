import { beforeEach, describe, expect, it } from 'vitest';
import { getBrisageSession, setBrisageSession } from '../../src/persistence/brisage-session';

// specs/061-simplification-page-brisage: the page comes back as it was after a reload.
describe('brisage-session', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips', () => {
    const session = {
      serverId: 'mikhal', item: { id: '777', name: 'Cape', level: 100, imageUrl: undefined },
      rolls: { 0: '44' }, coefficientText: '150', manualCost: '5000',
    };
    setBrisageSession(session);
    expect(getBrisageSession()).toEqual(session);
  });

  it('forgets the session when cleared', () => {
    setBrisageSession({ serverId: 'mikhal', item: { id: '1', name: 'A' }, rolls: {}, coefficientText: '', manualCost: '' });
    setBrisageSession(undefined);
    expect(getBrisageSession()).toBeUndefined();
  });

  it('ignores corrupted or wrong-typed storage and drops wrong-typed rolls', () => {
    window.localStorage.setItem('craftcheck-brisage-session', '{oops');
    expect(getBrisageSession()).toBeUndefined();
    window.localStorage.setItem('craftcheck-brisage-session', JSON.stringify({ serverId: 'm', item: { id: 5, name: 'A' } }));
    expect(getBrisageSession()).toBeUndefined();
    window.localStorage.setItem('craftcheck-brisage-session', JSON.stringify({ serverId: 'm', item: { id: '1', name: 'A' }, rolls: { 0: 3, 1: '7' }, coefficientText: 9 }));
    expect(getBrisageSession()).toEqual({ serverId: 'm', item: { id: '1', name: 'A', level: undefined, imageUrl: undefined }, rolls: { 1: '7' }, coefficientText: '', manualCost: '' });
  });
});

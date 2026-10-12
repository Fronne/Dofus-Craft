import { describe, expect, it } from 'vitest';
import {
  correctionValues, filterRunes, groupTabLabel, isRuneName, matchesItemQuery, mergeIgnoredLines, normalizeItemName, parsePurchaseLines,
  SEANCE_STATE_LABELS, spendingBySeance, summarizeByItem, unitPriceKamas, type RuneItem,
} from '../../src/domain/forgemagie';

// specs/025-rune-purchase-import (FR-022): the chat's purchase lines, read exactly like the bot.
describe('parsePurchaseLines', () => {
  it('reads the quantity, the item and the total of a purchase line', () => {
    const [line] = parsePurchaseLines('10 x [Rune Do Air] (15 868 kamas)');
    expect(line).toEqual({ itemName: 'Rune Do Air', quantity: 10, totalKamas: 15868 });
    expect(unitPriceKamas(line)).toBe(1587);
  });

  it('accepts narrow and non-breaking spaces as thousands separators', () => {
    expect(parsePurchaseLines('100 x [Rune Cri] (235\u202f999 kamas)\n1 x [Rune Fo] (1\u00a0200 kamas)')).toEqual([
      { itemName: 'Rune Cri', quantity: 100, totalKamas: 235999 },
      { itemName: 'Rune Fo', quantity: 1, totalKamas: 1200 },
    ]);
  });

  it('leaves out a line with a zero quantity or total', () => {
    expect(parsePurchaseLines('0 x [Rune Fo] (1 200 kamas)\n10 x [Rune Fo] (000 kamas)')).toEqual([]);
  });

  it('returns nothing for a text without purchase lines', () => {
    expect(parsePurchaseLines('Bonjour, vous avez gagné 12 kamas.')).toEqual([]);
  });

  it('keeps identical lines separate: they are lots bought one after the other', () => {
    const text = Array(4).fill('10 x [Rune Do Air] (15 868 kamas)').join('\n');
    const lines = parsePurchaseLines(text);
    expect(lines).toHaveLength(4);
    expect(summarizeByItem(lines)).toEqual([{ itemName: 'Rune Do Air', quantity: 40, totalKamas: 63472, averageUnitKamas: 1587 }]);
  });
});

describe('summarizeByItem', () => {
  it('sorts items by their total, largest first', () => {
    const summary = summarizeByItem([
      { itemName: 'Rune Fo', quantity: 10, totalKamas: 1000 },
      { itemName: 'Rune Cri', quantity: 1, totalKamas: 5000 },
      { itemName: 'Rune Fo', quantity: 5, totalKamas: 600 },
    ]);
    expect(summary.map((item) => [item.itemName, item.quantity, item.totalKamas, item.averageUnitKamas])).toEqual([
      ['Rune Cri', 1, 5000, 5000],
      ['Rune Fo', 15, 1600, 107],
    ]);
  });
});

describe('normalizeItemName', () => {
  it('ignores case and extra whitespace', () => {
    expect(normalizeItemName('  Rune   DO Air ')).toBe('rune do air');
  });

  it('keeps accents, so a misread name never matches by accident', () => {
    expect(normalizeItemName('Bois de Frêne')).not.toBe(normalizeItemName('Bois de Frene'));
  });
});

// specs/026-hdv-rune-prices: the Runes tab of the HDV page.
describe('filterRunes', () => {
  const rune = (id: string, name: string, statLabel: string): RuneItem =>
    ({ id, name, statLabel, imageUrl: '', level: 1, effectId: null, characteristicId: null });
  const runes = [rune('1', 'Rune Fo', 'Force'), rune('2', 'Rune Do Air', 'Dommages Air'), rune('3', 'Rune Ré Air', 'Résistances Air'), rune('4', 'Rune Pa Fo', 'Force')];
  const names = (list: RuneItem[]) => list.map((entry) => entry.name);

  it('searches names without case or accents, keeping the order', () => {
    expect(names(filterRunes(runes, { query: 'DO AIR', stat: '' }))).toEqual(['Rune Do Air']);
    expect(names(filterRunes(runes, { query: 're air', stat: '' }))).toEqual(['Rune Ré Air']);
  });

  it('keeps only the chosen stat, alone or with a search', () => {
    expect(names(filterRunes(runes, { query: '', stat: 'Force' }))).toEqual(['Rune Fo', 'Rune Pa Fo']);
    expect(names(filterRunes(runes, { query: 'pa', stat: 'Force' }))).toEqual(['Rune Pa Fo']);
    expect(filterRunes(runes, { query: '', stat: '' })).toEqual(runes);
  });
});

// specs/031-fm-session-captures (FR-009): the player's items matched by the session's item search.
describe('matchesItemQuery', () => {
  const rtograf = { label: 'Mon Rtograf PA', itemName: 'Anneau Rtograf' };

  it('finds an item by its own name or its equipment, ignoring case and accents', () => {
    expect(matchesItemQuery(rtograf, 'rtog')).toBe(true);
    expect(matchesItemQuery(rtograf, 'ANNEAU')).toBe(true);
    expect(matchesItemQuery({ label: null, itemName: 'Épée de Boisaille' }, 'epee  de')).toBe(true);
    expect(matchesItemQuery({ label: null, itemName: 'Coiffe Bouftou' }, 'bouftôu')).toBe(true);
  });

  it('matches nothing for another name or an empty query', () => {
    expect(matchesItemQuery(rtograf, 'bouftou')).toBe(false);
    expect(matchesItemQuery(rtograf, '   ')).toBe(false);
  });
});

// specs/049-fm-seances: the pure rules of the séances de FM.
describe('groupTabLabel', () => {
  it('names the players\' tab after the group\'s Discord server', () => {
    expect(groupTabLabel({ guildName: 'Les Forgemages' })).toBe('Les Forgemages');
    expect(groupTabLabel({ guildName: '  Les Forgemages  ' })).toBe('Les Forgemages');
  });

  it('falls back to « Joueurs » when the name is unknown or empty', () => {
    expect(groupTabLabel({})).toBe('Joueurs');
    expect(groupTabLabel({ guildName: null })).toBe('Joueurs');
    expect(groupTabLabel({ guildName: '   ' })).toBe('Joueurs');
  });
});

describe('SEANCE_STATE_LABELS', () => {
  it('names the three states of a séance', () => {
    expect(SEANCE_STATE_LABELS).toEqual({ running: 'En cours', paused: 'En pause', archived: 'Archivée' });
  });
});

describe('isRuneName', () => {
  it('recognizes a rune by its name, whatever the case and the accents', () => {
    expect(isRuneName('Rune Do Air')).toBe(true);
    expect(isRuneName('rune ré feu')).toBe(true);
    expect(isRuneName('  RUNE  Ga Pa')).toBe(true);
  });

  it('refuses what is not a rune', () => {
    expect(isRuneName('Runebook')).toBe(false);
    expect(isRuneName('Rune')).toBe(false);
    expect(isRuneName('Potion de rappel')).toBe(false);
    expect(isRuneName('')).toBe(false);
  });
});

describe('mergeIgnoredLines', () => {
  it('lists an item bought several times once, its quantities and totals added up', () => {
    expect(mergeIgnoredLines([
      { itemName: 'Potion de rappel', quantity: 1, totalKamas: 300 },
      { itemName: 'Orbe régénérant', quantity: 1, totalKamas: 90000 },
      { itemName: 'Potion de rappel', quantity: 2, totalKamas: 700 },
    ])).toEqual([
      { itemName: 'Potion de rappel', quantity: 3, totalKamas: 1000 },
      { itemName: 'Orbe régénérant', quantity: 1, totalKamas: 90000 },
    ]);
  });

  it('leaves the lines it was given untouched', () => {
    const lines = [{ itemName: 'Potion', quantity: 1, totalKamas: 10 }, { itemName: 'Potion', quantity: 1, totalKamas: 10 }];
    mergeIgnoredLines(lines);
    expect(lines[0]).toEqual({ itemName: 'Potion', quantity: 1, totalKamas: 10 });
    expect(mergeIgnoredLines([])).toEqual([]);
  });
});

describe('spendingBySeance', () => {
  const session = (sessionId: string, channelId: string | null | undefined, openedAt: string, spentKamas: number, canOpen = true) =>
    ({ sessionId, channelId, channelName: `fm-${channelId ?? sessionId}`, openedAt, spentKamas, canOpen });

  it('adds up the sessions of a séance, dated by the latest, the most recent séance first', () => {
    expect(spendingBySeance([
      session('s1', 'c1', '2026-09-28T10:00:00.000Z', 1000),
      session('s2', 'c2', '2026-09-29T10:00:00.000Z', 500),
      session('s3', 'c1', '2026-09-30T10:00:00.000Z', 2000),
    ])).toEqual([
      { key: 'c1', seanceId: 'c1', name: 'fm-c1', lastOpenedAt: '2026-09-30T10:00:00.000Z', spentKamas: 3000 },
      { key: 'c2', seanceId: 'c2', name: 'fm-c2', lastOpenedAt: '2026-09-29T10:00:00.000Z', spentKamas: 500 },
    ]);
  });

  it('gives no link to a séance the viewer cannot open', () => {
    expect(spendingBySeance([session('s1', 'c1', '2026-09-28T10:00:00.000Z', 1000, false)])[0].seanceId).toBeUndefined();
  });

  it('keeps a session without a known séance on a line of its own, without a link', () => {
    const lines = spendingBySeance([
      session('s1', undefined, '2026-09-28T10:00:00.000Z', 1000),
      session('s2', null, '2026-09-29T10:00:00.000Z', 500),
    ]);
    expect(lines.map((line) => [line.key, line.seanceId, line.spentKamas])).toEqual([['s2', undefined, 500], ['s1', undefined, 1000]]);
  });

  it('is empty without sessions', () => {
    expect(spendingBySeance([])).toEqual([]);
  });
});

describe('correctionValues', () => {
  it('reads whole numbers of at least 1, spaces as thousands separators', () => {
    expect(correctionValues('10', '15868')).toEqual({ quantity: 10, totalKamas: 15868 });
    expect(correctionValues(' 1 ', '15 868')).toEqual({ quantity: 1, totalKamas: 15868 });
    expect(correctionValues('1', '15\u202f868')).toEqual({ quantity: 1, totalKamas: 15868 });
  });

  it('refuses zero, an empty field and what is not a whole number', () => {
    expect(correctionValues('0', '100')).toBeUndefined();
    expect(correctionValues('1', '0')).toBeUndefined();
    expect(correctionValues('', '100')).toBeUndefined();
    expect(correctionValues('1', '')).toBeUndefined();
    expect(correctionValues('dix', '100')).toBeUndefined();
    expect(correctionValues('1.5', '100')).toBeUndefined();
    expect(correctionValues('-1', '100')).toBeUndefined();
  });
});

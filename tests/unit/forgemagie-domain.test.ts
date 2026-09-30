import { describe, expect, it } from 'vitest';
import { normalizeItemName, parsePurchaseLines, summarizeByItem, unitPriceKamas } from '../../src/domain/forgemagie';

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

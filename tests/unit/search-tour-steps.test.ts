import { describe, expect, it } from 'vitest';
import { searchTourSteps } from '../../src/features/onboarding/search-tour-steps';

// Sentences end with ".", "!" or "?" (A1 in the specs/011 analysis).
function sentenceCount(text: string) {
  return text.split(/[.!?](?:\s|$)/).filter((part) => part.trim().length > 0).length;
}

describe('searchTourSteps (specs/011-search-onboarding)', () => {
  for (const mode of ['personal', 'community'] as const) {
    describe(`en ${mode}`, () => {
      const steps = searchTourSteps(mode);

      it('lists the six steps in FR-003 order', () => {
        expect(steps.map((step) => step.id)).toEqual([
          'search', 'market-price', 'recommendation', 'recipe', 'resource-prices', 'price-mode',
        ]);
      });

      it('keeps every bubble to one sentence and at most three points (FR-004)', () => {
        for (const step of steps) {
          expect(sentenceCount(step.body), step.id).toBe(1);
          expect(step.points?.length ?? 0, step.id).toBeLessThanOrEqual(3);
        }
      });

      it('explains "Dernière mise à jour" and the stale highlight on the resource step (US3)', () => {
        const terms = steps.find((step) => step.id === 'resource-prices')!.points!.map((point) => point.term);
        expect(terms).toContain('Dernière mise à jour');
        expect(terms).toContain('Prix surligné');
      });

      it('shows the price-mode step as a centered bubble explaining both modes (US3)', () => {
        const step = steps.find((item) => item.id === 'price-mode')!;
        expect(step.target).toBeUndefined();
        expect(step.points!.map((point) => point.term)).toEqual(['Mode communautaire', 'Mode personnel']);
        expect(step.body).toContain('Paramètres');
      });
    });
  }

  it('names the active mode and mentions contributions only in Mode communautaire', () => {
    const community = searchTourSteps('community');
    const personal = searchTourSteps('personal');
    expect(community.at(-1)!.title).toContain('Mode communautaire');
    expect(personal.at(-1)!.title).toContain('Mode personnel');
    const terms = (steps: typeof community) =>
      steps.find((step) => step.id === 'resource-prices')!.points!.map((point) => point.term);
    expect(terms(community)).toContain('N contributions');
    expect(terms(personal)).not.toContain('N contributions');
  });
});

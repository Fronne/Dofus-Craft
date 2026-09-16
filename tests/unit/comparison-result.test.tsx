import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RecommendationBadge, insufficientDataHint } from '../../src/features/comparison/ComparisonResult';
import type { Comparison } from '../../src/domain/types';

const baseResult: Comparison = {
  lines: [],
  knownCraftCostKamas: 0,
  missingResourceIds: [],
  craftCostStatus: 'partial',
  recommendation: 'insufficient-data',
};

describe('insufficientDataHint', () => {
  it('names the missing resource prices', () => {
    const result: Comparison = { ...baseResult, missingResourceIds: ['a', 'b'], marketPriceKamas: 500 };
    expect(insufficientDataHint(result)).toBe('Comparaison incomplète : 2 prix de ressources manquants.');
  });

  it('names the missing HDV price', () => {
    const result: Comparison = { ...baseResult, craftCostStatus: 'complete' };
    expect(insufficientDataHint(result)).toBe('Comparaison incomplète : le prix HDV n’est pas renseigné.');
  });

  it('names both reasons together', () => {
    const result: Comparison = { ...baseResult, missingResourceIds: ['a'] };
    expect(insufficientDataHint(result)).toBe(
      'Comparaison incomplète : 1 prix de ressource manquant et le prix HDV n’est pas renseigné.',
    );
  });

  it('is undefined once the comparison is conclusive', () => {
    const result: Comparison = { ...baseResult, recommendation: 'craft', craftCostStatus: 'complete', marketPriceKamas: 500 };
    expect(insufficientDataHint(result)).toBeUndefined();
  });
});

describe('RecommendationBadge', () => {
  it('shows the incomplete-data reason as plain visible text, not a hover-only tooltip', () => {
    render(<RecommendationBadge recommendation="insufficient-data" hint="Comparaison incomplète : le prix HDV n’est pas renseigné." />);

    // A hover-only explanation (e.g. a bare `title` attribute) is unreachable on touch devices,
    // so this must render as ordinary text a tap or a screen reader can already see.
    expect(screen.getByText('Comparaison incomplète : le prix HDV n’est pas renseigné.')).toBeInTheDocument();
  });

  it('renders no hint text when the recommendation is conclusive', () => {
    const { container } = render(<RecommendationBadge recommendation="craft" />);
    expect(container.querySelector('.badge-hint')).not.toBeInTheDocument();
  });
});

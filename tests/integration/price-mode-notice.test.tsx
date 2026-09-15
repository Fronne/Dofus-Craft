import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PriceModeNotice } from '../../src/features/comparison/PriceModeNotice';

describe('PriceModeNotice', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the "à venir" message when community mode is active', () => {
    render(<PriceModeNotice priceMode="community" />);

    expect(screen.getByRole('status')).toHaveTextContent(/pas encore disponibles/);
  });

  it('renders nothing in personal mode', () => {
    render(<PriceModeNotice priceMode="personal" />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('has no dismiss control and keeps rendering across re-renders while community mode stays active', () => {
    const { rerender } = render(<PriceModeNotice priceMode="community" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<PriceModeNotice priceMode="community" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

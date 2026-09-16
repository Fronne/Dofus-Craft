import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemResults } from '../../src/features/catalogue/ItemResults';

describe('ItemResults controls', () => {
  it('offers all supported result limits and updates immediately', () => {
    const setResultLimit = vi.fn();
    render(
      <ItemResults
        items={[{ id: '1', name: 'Item', level: 1, kind: 'Equipment', categoryId: 'equipment-type-1' }]}
        selected=""
        onSelect={vi.fn()}
        total={50}
        resultLimit={12}
        setResultLimit={setResultLimit}
      />,
    );

    const select = screen.getByLabelText('Afficher :');
    expect(select).toHaveValue('12');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['12', '24', '48', '96']);
    fireEvent.change(select, { target: { value: '96' } });
    expect(setResultLimit).toHaveBeenCalledWith(96);
    expect(screen.getByText('50 objets trouvés')).toBeInTheDocument();
  });

  it('shows the item count even before any filter is applied', () => {
    // The catalogue is preloaded in the background from app start (App.tsx), so by the time
    // this renders, `total` reflects the real matching count rather than a capped preview —
    // safe to always show it as a number instead of a generic placeholder label.
    render(
      <ItemResults
        items={[{ id: '1', name: 'Item', level: 1, kind: 'Equipment', categoryId: 'equipment-type-1' }]}
        selected=""
        onSelect={vi.fn()}
        total={21}
        resultLimit={12}
        setResultLimit={vi.fn()}
      />,
    );

    expect(screen.getByText('21 objets trouvés')).toBeInTheDocument();
  });
});

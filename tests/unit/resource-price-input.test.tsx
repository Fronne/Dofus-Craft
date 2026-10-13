import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResourcePriceInput } from '../../src/features/comparison/ResourcePriceInput';

const resource = { id: 'resource-1', name: 'Bois' };

// ResourcePriceInput is a controlled component — a real caller (RecherchePage) re-renders it with
// the updated `value` after every `onChange`. This wrapper reproduces that so tests can catch bugs
// that only appear once `value` actually flips from empty to non-empty across renders.
function ControlledResourcePriceInput({
  initialValue = '',
  onCommit,
}: {
  initialValue?: string;
  onCommit?: (value: string) => Promise<'accepted' | 'rejected' | void>;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <ResourcePriceInput
      resource={resource}
      quantity={1}
      value={value}
      onChange={setValue}
      onCommit={onCommit}
    />
  );
}

// specs/052-direct-price-entry: no locked state any more — the price is typed over directly.
describe('ResourcePriceInput direct entry', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('is directly editable, with the kamas symbol and no edit button, once a price is saved', () => {
    render(<ResourcePriceInput resource={resource} quantity={1} value="500" onChange={vi.fn()} onCommit={vi.fn()} />);

    expect(screen.getByPlaceholderText('Prix unitaire')).not.toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Modifier ce prix' })).not.toBeInTheDocument();
    expect(screen.getByAltText('kamas')).toBeInTheDocument();
  });

  it('selects the whole price when the field is focused', () => {
    render(<ResourcePriceInput resource={resource} quantity={1} value="12500" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText('Prix unitaire') as HTMLInputElement;

    input.focus();

    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it('puts back the price held on entry on Escape, without committing', () => {
    const onCommit = vi.fn();
    render(<ControlledResourcePriceInput initialValue="500" onCommit={onCommit} />);
    const input = screen.getByPlaceholderText('Prix unitaire');

    input.focus();
    fireEvent.change(input, { target: { value: '750' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input).toHaveValue('500');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('goes back to the previous price when the commit is rejected', async () => {
    render(<ControlledResourcePriceInput initialValue="500" onCommit={async () => 'rejected'} />);
    const input = screen.getByPlaceholderText('Prix unitaire');

    fireEvent.change(input, { target: { value: '750' } });
    fireEvent.blur(input);

    await waitFor(() => expect(input).toHaveValue('500'));
  });

  // FR-008: a page that unloads mid-typing hands the price over, once.
  it('hands a typed price over when the page unloads, and not again on the blur that follows', () => {
    const onCommit = vi.fn();
    const onUnloadCommit = vi.fn();
    const onBlur = vi.fn();
    function Field() {
      const [value, setValue] = useState('500');
      return <ResourcePriceInput resource={resource} quantity={1} value={value} onChange={setValue} onBlur={onBlur} onCommit={onCommit} onUnloadCommit={onUnloadCommit} />;
    }
    render(<Field />);
    const input = screen.getByPlaceholderText('Prix unitaire');

    fireEvent.change(input, { target: { value: '750' } });
    fireEvent(window, new Event('pagehide'));

    expect(onUnloadCommit).toHaveBeenCalledTimes(1);
    expect(onUnloadCommit).toHaveBeenCalledWith('750');
    expect(onBlur).toHaveBeenCalledWith('750');

    fireEvent.blur(input);
    fireEvent(window, new Event('pagehide'));
    expect(onUnloadCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('hands nothing over on unload when nothing was typed, or when the field was emptied', () => {
    const onUnloadCommit = vi.fn();
    const onBlur = vi.fn();
    function Field() {
      const [value, setValue] = useState('500');
      return <ResourcePriceInput resource={resource} quantity={1} value={value} onChange={setValue} onBlur={onBlur} onCommit={vi.fn()} onUnloadCommit={onUnloadCommit} />;
    }
    render(<Field />);
    const input = screen.getByPlaceholderText('Prix unitaire');

    input.focus();
    fireEvent(window, new Event('pagehide'));
    fireEvent.change(input, { target: { value: '' } });
    fireEvent(window, new Event('pagehide'));

    expect(onUnloadCommit).not.toHaveBeenCalled();
    expect(onBlur).not.toHaveBeenCalled();
  });
});

// specs/008-stale-resource-highlight: US1 — the row is flagged orange/red once its price is old.
describe('ResourcePriceInput price age highlighting', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  it('applies no age class when the price was updated less than 3 days ago', () => {
    render(<ResourcePriceInput resource={resource} quantity={1} value="500" updatedAt={daysAgo(1)} onChange={vi.fn()} />);

    const label = screen.getByPlaceholderText('Prix unitaire').closest('label');
    expect(label).not.toHaveClass('price-line--stale');
    expect(label).not.toHaveClass('price-line--expired');
    // specs/004 (révision du 2026-09-25): no contribution count on the line.
    expect(screen.queryByText(/contribution/)).not.toBeInTheDocument();
  });

  it('applies price-line--stale when the price is between 3 and 7 days old', () => {
    render(<ResourcePriceInput resource={resource} quantity={1} value="500" updatedAt={daysAgo(4)} onChange={vi.fn()} />);

    expect(screen.getByPlaceholderText('Prix unitaire').closest('label')).toHaveClass('price-line--stale');
  });

  it('applies price-line--expired when the price is 7 days old or more', () => {
    render(<ResourcePriceInput resource={resource} quantity={1} value="500" updatedAt={daysAgo(8)} onChange={vi.fn()} />);

    expect(screen.getByPlaceholderText('Prix unitaire').closest('label')).toHaveClass('price-line--expired');
  });

  it('applies no age class when there is no known price', () => {
    render(
      <ResourcePriceInput
        resource={resource}
        quantity={1}
        value=""
        onChange={vi.fn()}
      />,
    );

    const label = screen.getByPlaceholderText('Prix unitaire').closest('label');
    expect(label).not.toHaveClass('price-line--stale');
    expect(label).not.toHaveClass('price-line--expired');
  });

});

// specs/008-stale-resource-highlight: US3 — hovering a row with an old price explains that it may
// no longer match the in-game price.
describe('ResourcePriceInput price age tooltip', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  it('renders no explanatory tooltip when the price is fresh (< 3 days)', () => {
    render(<ResourcePriceInput resource={resource} quantity={1} value="500" updatedAt={daysAgo(1)} onChange={vi.fn()} />);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders no explanatory tooltip when there is no known price', () => {
    render(<ResourcePriceInput resource={resource} quantity={1} value="" onChange={vi.fn()} />);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders an explanatory tooltip when the price is stale (3-7 days)', () => {
    render(<ResourcePriceInput resource={resource} quantity={1} value="500" updatedAt={daysAgo(4)} onChange={vi.fn()} />);

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      "Prix ancien, peut différer du prix actuel en jeu.",
    );
  });

  it('renders an explanatory tooltip when the price is expired (>= 7 days)', () => {
    render(<ResourcePriceInput resource={resource} quantity={1} value="500" updatedAt={daysAgo(10)} onChange={vi.fn()} />);

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      "Prix ancien, peut différer du prix actuel en jeu.",
    );
  });
});

// specs/004-community-price-sharing (révision 4): FR-017/FR-020 — a commit (blur) only fires
// `onCommit` when the value actually changed since the field was last unlocked, never on a no-op
// blur (specs/052: no locked state any more).
describe('ResourcePriceInput onCommit (Mode communautaire)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('calls onCommit once, with the new value, when a filled field is unlocked, changed, then blurred', () => {
    const onCommit = vi.fn();
    render(<ControlledResourcePriceInput initialValue="500" onCommit={onCommit} />);

    const input = screen.getByPlaceholderText('Prix unitaire');
    fireEvent.change(input, { target: { value: '750' } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('750');
  });

  it('calls onCommit once, with the typed value, when a first price is typed into an empty field then blurred', () => {
    const onCommit = vi.fn();
    render(<ControlledResourcePriceInput onCommit={onCommit} />);

    const input = screen.getByPlaceholderText('Prix unitaire');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('50');
  });

  it('does not call onCommit when the field is unlocked and blurred again without any change', () => {
    const onCommit = vi.fn();
    render(<ControlledResourcePriceInput initialValue="500" onCommit={onCommit} />);

    fireEvent.blur(screen.getByPlaceholderText('Prix unitaire'));

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('does not call onCommit when a price that arrived after mount (carnet load, community prefill) is focused then blurred without editing', () => {
    // The row mounts empty, then its price shows up from outside — the player never typed it.
    // Double-clicking the row focuses the locked field; blurring it must not count as an edit.
    const onCommit = vi.fn();
    const { rerender } = render(
      <ResourcePriceInput resource={resource} quantity={1} value="" onChange={vi.fn()} onCommit={onCommit} />,
    );
    rerender(
      <ResourcePriceInput resource={resource} quantity={1} value="548" onChange={vi.fn()} onCommit={onCommit} />,
    );

    const input = screen.getByPlaceholderText('Prix unitaire');
    fireEvent.doubleClick(input);
    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('does not call onCommit when the caller did not take the typed value (the price shown is unchanged)', () => {
    const onCommit = vi.fn();
    render(<ResourcePriceInput resource={resource} quantity={1} value="500" onChange={vi.fn()} onCommit={onCommit} />);

    const input = screen.getByPlaceholderText('Prix unitaire');
    fireEvent.change(input, { target: { value: '750' } });
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('ResourcePriceInput label (regression: copyable resource name)', () => {
  it('labels the price input, not the copy button placed inside the same row', () => {
    render(
      <ResourcePriceInput
        resource={{ id: '8308', name: 'Peau de Gloot' }}
        quantity={3}
        value=""
        onChange={() => undefined}
      />,
    );
    const input = screen.getByPlaceholderText('Prix unitaire');
    const label = input.closest('label') as HTMLLabelElement;
    expect(label.control).toBe(input);
  });
});

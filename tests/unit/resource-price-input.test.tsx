import { fireEvent, render, screen } from '@testing-library/react';
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
  onCommit?: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <ResourcePriceInput
      resource={resource}
      quantity={1}
      value={value}
      lockWhenFilled
      onChange={setValue}
      onCommit={onCommit}
    />
  );
}

describe('ResourcePriceInput lockWhenFilled (Mode communautaire)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('is directly editable, with no lock and no edit button, when lockWhenFilled is not set (Mode personnel)', () => {
    render(<ResourcePriceInput resource={resource} quantity={1} value="500" onChange={vi.fn()} />);

    expect(screen.getByPlaceholderText('Prix unitaire')).not.toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Modifier ce prix' })).not.toBeInTheDocument();
  });

  it('stays directly editable, with no lock, when lockWhenFilled is set but no price is saved yet', () => {
    render(<ResourcePriceInput resource={resource} quantity={1} value="" lockWhenFilled onChange={vi.fn()} />);

    expect(screen.getByPlaceholderText('Prix unitaire')).not.toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Modifier ce prix' })).not.toBeInTheDocument();
  });

  it('locks the field and shows an edit button once a price is saved, when lockWhenFilled is set', () => {
    render(<ResourcePriceInput resource={resource} quantity={1} value="500" lockWhenFilled onChange={vi.fn()} />);

    expect(screen.getByPlaceholderText('Prix unitaire')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Modifier ce prix' })).toBeInTheDocument();
  });

  it('unlocks and focuses the field when the edit button is clicked, then re-locks automatically on blur', () => {
    render(<ResourcePriceInput resource={resource} quantity={1} value="500" lockWhenFilled onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Modifier ce prix' }));

    const input = screen.getByPlaceholderText('Prix unitaire');
    expect(input).not.toHaveAttribute('readonly');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Modifier ce prix' })).not.toBeInTheDocument();

    fireEvent.blur(input);

    expect(screen.getByPlaceholderText('Prix unitaire')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Modifier ce prix' })).toBeInTheDocument();
  });

  it('lets the value actually be edited once unlocked', () => {
    const onChange = vi.fn();
    render(<ResourcePriceInput resource={resource} quantity={1} value="500" lockWhenFilled onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Modifier ce prix' }));
    fireEvent.change(screen.getByPlaceholderText('Prix unitaire'), { target: { value: '750' } });

    expect(onChange).toHaveBeenCalledWith('750');
  });

  it('never locks itself out mid-typing while entering a first price into a field that started empty', () => {
    render(<ControlledResourcePriceInput />);
    const input = screen.getByPlaceholderText('Prix unitaire');

    // Typing digit by digit re-renders with a growing, now-truthy `value` after every keystroke —
    // this must not flip the field to readOnly (and therefore un-typable) partway through.
    fireEvent.change(input, { target: { value: '5' } });
    expect(input).not.toHaveAttribute('readonly');
    fireEvent.change(input, { target: { value: '50' } });
    expect(input).not.toHaveAttribute('readonly');
    fireEvent.change(input, { target: { value: '500' } });
    expect(input).not.toHaveAttribute('readonly');
    expect(input).toHaveValue('500');

    // Only once the player is done (blur) does it lock, protecting the value just entered.
    fireEvent.blur(input);
    expect(screen.getByPlaceholderText('Prix unitaire')).toHaveAttribute('readonly');
  });
});

// specs/004-community-price-sharing (révision 4): FR-017/FR-020 — a commit (blur) only fires
// `onCommit` when the value actually changed since the field was last unlocked, never on a no-op
// blur, and never at all outside `lockWhenFilled` (Mode personnel).
describe('ResourcePriceInput onCommit (Mode communautaire)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('calls onCommit once, with the new value, when a filled field is unlocked, changed, then blurred', () => {
    const onCommit = vi.fn();
    render(<ControlledResourcePriceInput initialValue="500" onCommit={onCommit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Modifier ce prix' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Modifier ce prix' }));
    fireEvent.blur(screen.getByPlaceholderText('Prix unitaire'));

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('never calls onCommit when lockWhenFilled is not set, even if a value changes and the field is blurred', () => {
    const onCommit = vi.fn();
    render(<ResourcePriceInput resource={resource} quantity={1} value="500" onChange={vi.fn()} onCommit={onCommit} />);

    const input = screen.getByPlaceholderText('Prix unitaire');
    fireEvent.change(input, { target: { value: '750' } });
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
  });
});

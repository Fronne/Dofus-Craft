import { useRef, useState } from 'react';
import type { Resource } from '../../domain/types';
import { KAMAS_ICON_URL, formatKamas, formatKamasInput, isValidKamas, normalizeKamasInput } from '../../domain/kamas';
import { formatRelativeTime } from '../../domain/time';
import { classifyPriceAge } from '../../domain/price-age';
import { ResourceDisplay } from '../catalogue/ResourceDisplay';
import { Icon } from '../../components/Icon';

export function ResourcePriceInput({
  resource,
  quantity,
  value,
  updatedAt,
  communityMeta,
  lockWhenFilled,
  onChange,
  onBlur,
  onCommit,
}: {
  resource: Resource;
  quantity: number;
  value: string;
  updatedAt?: string;
  // FR-007: contribution count (and, when the value shown is potentially stale, US5's compact
  // marker), rendered by extending the existing timestamp line below rather than a separate line.
  communityMeta?: { sampleSize: number; stale: boolean };
  // Mode communautaire only: once a price is already saved for this resource, the field starts
  // read-only and requires an explicit click on the edit button to modify it, re-locking
  // automatically on blur — guards a pre-filled or already-confirmed community price against an
  // accidental keystroke. Mode personnel is unaffected (prop omitted there).
  lockWhenFilled?: boolean;
  onChange: (value: string) => void;
  // Called on every blur with the field's current value, regardless of `lockWhenFilled` — the
  // caller decides whether the value actually changed (e.g. against its own persisted copy)
  // before writing it anywhere. Persistence is deferred to this callback rather than `onChange`
  // precisely so that "dernière mise à jour" only moves once the player is done typing, not on
  // every keystroke.
  onBlur?: (value: string) => void;
  // FR-017/FR-020: called on blur, only when `lockWhenFilled` is set and the value actually
  // changed since the field was last unlocked — never on a no-op blur (edit button clicked, then
  // blurred again without typing anything). Mode personnel is unaffected (prop omitted there).
  // specs/007-outlier-confirmation, FR-007: may resolve to 'rejected' (e.g. the player canceled an
  // outlier confirmation) — in that case the field reverts to its pre-edit value below, using the
  // same `lastCommittedValueRef` already tracked for the FR-020 no-op guard. A caller that returns
  // `void` (none today besides the outlier-aware one) keeps today's behavior: never reverted.
  onCommit?: (value: string) => Promise<'accepted' | 'rejected' | void>;
}) {
  const valid = isValidKamas(value);
  const communityLabel = communityMeta
    ? `${communityMeta.sampleSize} contribution${communityMeta.sampleSize > 1 ? 's' : ''}${communityMeta.stale ? ' — peut-être daté' : ''}`
    : undefined;
  const [editing, setEditing] = useState(false);
  const locked = Boolean(lockWhenFilled) && Boolean(value) && !editing;
  const inputRef = useRef<HTMLInputElement>(null);
  const lastCommittedValueRef = useRef(value);
  // specs/008-stale-resource-highlight: 'unknown' and 'fresh' add no class — only a price that has
  // actually gone stale/expired gets flagged (FR-004/FR-005).
  const priceAge = classifyPriceAge(updatedAt);
  const priceAgeClass =
    priceAge === 'stale' ? ' price-line--stale' : priceAge === 'expired' ? ' price-line--expired' : '';
  // FR-010/FR-011: same 'stale'/'expired' condition as the coloring above, so the tooltip never
  // appears without the visual cue that motivates it (or vice versa).
  const priceAgeTooltip =
    priceAge === 'stale' || priceAge === 'expired'
      ? 'Prix ancien, peut différer du prix actuel en jeu.'
      : undefined;
  return (
    <label className={`price-line${priceAgeClass}`}>
      <span className="price-resource">
        <ResourceDisplay resource={resource} />
      </span>
      <span className="price-resource-quantity">× {quantity}</span>
      {(updatedAt || communityLabel) && (
        <small>
          {updatedAt && `Dernière mise à jour : ${formatRelativeTime(updatedAt)}`}
          {updatedAt && communityLabel && ' · '}
          {communityLabel}
          {priceAgeTooltip && (
            <span className="price-age-tooltip" role="tooltip">
              {priceAgeTooltip}
            </span>
          )}
        </small>
      )}
      <span className="kamas-input-wrap">
        <input
          ref={inputRef}
          inputMode="numeric"
          aria-invalid={!valid}
          value={formatKamasInput(value)}
          onChange={(event) => {
            // Marking as "editing" here too (not just on the edit-button click) matters for a
            // field that started empty: typing its first character makes `value` truthy, and
            // without this the very next render would compute `locked = true` and cut the player
            // off mid-keystroke. Blur is still what re-locks it once they're done.
            // Capturing the pre-edit value here too (only on the very first keystroke of an edit
            // session, guarded by `!editing`) lets onBlur below tell a real edit apart from a
            // no-op one for a field that started empty (FR-020) — `value` here is still the prop
            // from before this keystroke, since the parent hasn't re-rendered yet.
            if (lockWhenFilled && !editing) lastCommittedValueRef.current = value;
            if (lockWhenFilled) setEditing(true);
            onChange(normalizeKamasInput(event.target.value));
          }}
          onBlur={() => {
            onBlur?.(value);
            if (!lockWhenFilled) return;
            setEditing(false);
            if (value === lastCommittedValueRef.current) return;
            const previousValue = lastCommittedValueRef.current;
            const result = onCommit?.(value);
            if (result) {
              void result.then((outcome) => {
                if (outcome === 'rejected') onChange(previousValue);
              });
            }
          }}
          placeholder="Prix unitaire"
          readOnly={locked}
        />
        {value && !locked && <img src={KAMAS_ICON_URL} alt="kamas" className="kamas-input-suffix" width={18} height={18} />}
        {locked && (
          <button
            type="button"
            className="kamas-input-edit-button"
            aria-label="Modifier ce prix"
            onClick={(event) => {
              event.preventDefault();
              lastCommittedValueRef.current = value;
              setEditing(true);
              inputRef.current?.focus();
            }}
          >
            <Icon name="edit" size={14} />
          </button>
        )}
      </span>
      {value && valid && <b className="price-resource-formatted">{formatKamas(Number(value) * quantity)}</b>}
      {!valid && <em>Entrez un nombre entier positif ou zéro.</em>}
    </label>
  );
}

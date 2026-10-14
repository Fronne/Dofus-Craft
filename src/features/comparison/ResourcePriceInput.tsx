import { useId, type ReactNode } from 'react';
import type { Resource } from '../../domain/types';
import { KAMAS_ICON_URL, formatKamas, formatKamasInput, isValidKamas } from '../../domain/kamas';
import { formatRelativeTime } from '../../domain/time';
import { classifyPriceAge } from '../../domain/price-age';
import { ResourceDisplay } from '../catalogue/ResourceDisplay';
import { usePriceEntry } from './usePriceEntry';

export function ResourcePriceInput({
  resource,
  quantity,
  value,
  updatedAt,
  onChange,
  onBlur,
  onCommit,
  onUnloadCommit,
  retained,
  subtotalKamas,
  history,
  caption,
  priceNote,
}: {
  resource: Resource;
  quantity: number;
  value: string;
  updatedAt?: string;
  onChange: (value: string) => void;
  // Called on every blur with the field's current value — the caller decides whether the value
  // actually changed (e.g. against its own persisted copy) before writing it anywhere. Persistence
  // is deferred to this callback rather than `onChange` precisely so that "dernière mise à jour"
  // only moves once the player is done typing, not on every keystroke.
  onBlur?: (value: string) => void;
  // Mode communautaire (specs/004 FR-017/FR-020): called on blur, only when the player typed and the
  // value actually changed — never on a no-op blur. specs/007-outlier-confirmation, FR-007: may
  // resolve to 'rejected' (e.g. the player canceled an outlier confirmation) — the field then goes
  // back to the value the typing started from. Mode personnel is unaffected (prop omitted there).
  onCommit?: (value: string) => Promise<'accepted' | 'rejected' | void>;
  // specs/052-direct-price-entry (FR-008/FR-009): the page unloads with a typed price not shared
  // yet — shared then, without any confirmation.
  onUnloadCommit?: (value: string) => void;
  // specs/015: for a craftable resource, which of buying or crafting is counted, and for how much —
  // rendered on its own row of the line. Omitted for a resource that doesn't craft.
  retained?: ReactNode;
  // specs/015: the line's subtotal once its retained cost is known (quantity × retained unit cost),
  // replacing the one computed from the typed price; `null` hides it (retained cost missing).
  subtotalKamas?: number | null;
  // specs/017: the price-history button, next to the quantity. Only passed in Mode communautaire.
  history?: ReactNode;
  // specs/023: shown instead of « × quantity » where a quantity means nothing (HDV page: the item type).
  caption?: ReactNode;
  // specs/047: what makes the price shown a fragile one (« peu de relevés », « relevé ancien »), after its date.
  priceNote?: string;
}) {
  const valid = isValidKamas(value);
  // specs/052-direct-price-entry: no locked state — focusing the field selects its price, ready to
  // be replaced; leaving it saves.
  const entry = usePriceEntry({ value, onChange, onBlur, onCommit, onUnloadCommit });
  // The label must point at the price input explicitly: it also contains the copyable resource
  // name, a <button>, which would otherwise become the label's control (first labelable
  // descendant) — clicking the row would then focus that button instead of the price field.
  const inputId = useId();
  const errorId = useId();
  // specs/008-stale-resource-highlight: 'unknown' and 'fresh' add no class — only a price that has
  // actually gone stale/expired gets flagged (FR-004/FR-005).
  const priceAge = classifyPriceAge(updatedAt);
  const priceAgeClass =
    priceAge === 'stale' ? ' price-line--stale' : priceAge === 'expired' ? ' price-line--expired' : '';
  const subtotal = subtotalKamas !== undefined
    ? subtotalKamas ?? undefined
    : value && valid ? Number(value) * quantity : undefined;
  return (
    <label className={`price-line${priceAgeClass}`} htmlFor={inputId}>
      <span className="price-resource">
        <ResourceDisplay resource={resource} copyable />
      </span>
      <span className="price-resource-quantity">
        {caption ?? <>× {quantity}</>}
      </span>
      {!updatedAt && priceNote && <small><span className="price-note">{priceNote}</span></small>}
      {updatedAt && (
        <small>
          Dernière mise à jour : {formatRelativeTime(updatedAt)}
          {priceNote && <span className="price-note"> · {priceNote}</span>}
          {/* The price-history button follows the date it gives the story of. */}
          {history}
        </small>
      )}
      {/* The price field; the price-history button comes right after it only while the price has no
          date to sit next to. */}
      <span className="price-input-cell">
        <span className="kamas-input-wrap">
          <input
            id={inputId}
            inputMode="numeric"
            aria-label={`Prix de ${resource.name}`}
            aria-invalid={!valid}
            aria-describedby={valid ? undefined : errorId}
            value={formatKamasInput(value)}
            onFocus={entry.onFocus}
            onMouseUp={entry.onMouseUp}
            onKeyDown={entry.onKeyDown}
            onChange={(event) => entry.onChange(event.target.value)}
            onBlur={entry.onBlur}
            placeholder="Prix unitaire"
          />
          {value && <img src={KAMAS_ICON_URL} alt="kamas" className="kamas-input-suffix" width={18} height={18} />}
        </span>
        {!updatedAt && history}
      </span>
      {subtotal !== undefined
        ? <b className="price-resource-formatted">{formatKamas(subtotal)}</b>
        // No subtotal yet: a dash holds its column where the lines sit under column titles (global.css).
        : <b className="price-resource-formatted price-resource-formatted--empty" aria-hidden="true">—</b>}
      {retained}
      {!valid && <em id={errorId} role="alert">Entrez un nombre entier positif ou zéro.</em>}
    </label>
  );
}
